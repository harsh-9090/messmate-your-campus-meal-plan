import { format, differenceInCalendarDays } from "date-fns";
import { query, withTx } from "../db/index.js";
import { getCache, setCache, delCache } from "../db/redis.js";

const getISTDate = () => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * 5.5)); // Force UTC+5.30 (Indian Standard Time)
};

const todayStr = () => format(getISTDate(), "yyyy-MM-dd");
const fmt12 = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  const p = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${p}`;
};
const inWindow = (now, w) => {
  const cur = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = w.start_time.split(":").map(Number);
  const [eh, em] = w.end_time.split(":").map(Number);
  return cur >= sh * 60 + sm && cur <= eh * 60 + em;
};

async function logScan({ memberId, memberName, meal, status, code, reason, scannedBy, deviceInfo }) {
  const date = todayStr();
  await query(
    `INSERT INTO scan_logs (member_id, member_name, meal, date, ts, status, denial_code, denial_reason, scanned_by, device_info)
     VALUES ($1,$2,$3,$4,NOW(),$5,$6,$7,$8,$9)`,
    [memberId || null, memberName || null, meal, date, status, code || null, reason || null, scannedBy || null, deviceInfo || null]
  );
  
  // Invalidate scan logs caches
  const invalidateKeys = [
    `messmate:scan:log:${date}`,
    ...(memberId ? [`messmate:scan:log:${date}:${memberId}`] : [])
  ];
  if (status === "denied") {
    invalidateKeys.push(`messmate:scan:denials:${date}`);
  }
  await delCache(invalidateKeys);
}

/** Strict 5-step validation. */
export async function validateAndRecord({ member, meal, scannedBy, deviceInfo }) {
  const date = todayStr();
  const memberInfo = member && { memberId: member.memberId, name: member.name };

  if (!member) {
    await logScan({ meal, status: "denied", code: "NOT_FOUND", reason: "Member not registered", scannedBy, deviceInfo });
    return { status: "denied", code: "NOT_FOUND", reason: "Member not registered", meal };
  }

  const sub = member.subscription || {};
  const base = { memberId: member.memberId, memberName: member.name, meal, scannedBy, deviceInfo };

  if (!sub.isPaid) {
    const start = sub.startDate ? new Date(sub.startDate) : new Date(member.createdAt);
    const daysSinceStart = differenceInCalendarDays(getISTDate(), start);
    const gracePeriod = 3;

    if (daysSinceStart > gracePeriod) {
      const reason = sub.amountPaid > 0 
        ? `Grace period (${gracePeriod} days) expired. Please pay the remaining ₹${sub.dueAmount}.`
        : `Payment pending. Please pay at the mess office.`;
      
      await logScan({ ...base, status: "denied", code: "UNPAID", reason });
      return { status: "denied", code: "UNPAID", reason, member: memberInfo, meal };
    }
    // Else: Allow during grace period, proceed to other checks
  }

  const now = getISTDate();
  const startDay = sub.startDate ? format(new Date(sub.startDate), "yyyy-MM-dd") : null;
  const endDay = sub.endDate ? format(new Date(sub.endDate), "yyyy-MM-dd") : null;

  if (!startDay || !endDay || date < startDay) {
    await logScan({ ...base, status: "denied", code: "EXPIRED", reason: "Plan not yet active" });
    return { status: "denied", code: "EXPIRED", reason: "Plan not yet active", member: memberInfo, meal };
  }
  if (date > endDay) {
    const daysAgo = differenceInCalendarDays(getISTDate(), new Date(sub.endDate));
    const reason = `Plan expired ${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`;
    await logScan({ ...base, status: "denied", code: "EXPIRED", reason });
    return { status: "denied", code: "EXPIRED", reason, member: memberInfo, meal };
  }

  if (!sub.meals?.includes(meal)) {
    const reason = `${meal} is not included in your ${sub.planLabel} plan`;
    await logScan({ ...base, status: "denied", code: "NOT_IN_PLAN", reason });
    return { status: "denied", code: "NOT_IN_PLAN", reason, member: memberInfo, meal };
  }

  const windowCacheKey = `messmate:window:${meal}`;
  let w = await getCache(windowCacheKey);
  if (!w) {
    const { rows: wRows } = await query(
      `SELECT meal, start_time, end_time FROM meal_windows WHERE meal = $1 AND is_active = TRUE`,
      [meal]
    );
    w = wRows[0] || null;
    if (w) await setCache(windowCacheKey, w, 1800); // 30 min
  }
  
  if (!w || !inWindow(now, w)) {
    const win = w ? `${fmt12(w.start_time)} – ${fmt12(w.end_time)}` : "not configured";
    const reason = `${meal} window is ${win}`;
    await logScan({ ...base, status: "denied", code: "WRONG_TIME", reason });
    return { status: "denied", code: "WRONG_TIME", reason, member: memberInfo, meal };
  }

  // STEP 5: atomic conditional update / insert
  const col = meal === "Breakfast" ? "used_breakfast" : meal === "Lunch" ? "used_lunch" : "used_dinner";
  const usage = await withTx(async (c) => {
    // upsert row, then conditionally flip the meal flag
    await c.query(
      `INSERT INTO meal_usage (member_id, date) VALUES ($1, $2)
       ON CONFLICT (member_id, date) DO NOTHING`,
      [member.memberId, date]
    );
    const upd = await c.query(
      `UPDATE meal_usage SET ${col} = TRUE, used_count = used_count + 1, updated_at = NOW()
       WHERE member_id = $1 AND date = $2 AND ${col} = FALSE
       RETURNING used_breakfast, used_lunch, used_dinner, used_count`,
      [member.memberId, date]
    );
    return upd.rows[0] || null;
  });

  if (!usage) {
    const reason = `${meal} already scanned today`;
    await logScan({ ...base, status: "denied", code: "ALREADY_USED", reason });
    return { status: "denied", code: "ALREADY_USED", reason, member: memberInfo, meal };
  }

  await logScan({ ...base, status: "allowed" });
  
  // Invalidate usage and reports on allowed scan
  await delCache([
    `messmate:usage:${member.memberId}:${date}`,
    `messmate:usage:summary:${date}`,
    `messmate:report:daily:${date}`
  ]);

  const totalToday = sub.meals.length;
  const used = (usage.used_breakfast ? 1 : 0) + (usage.used_lunch ? 1 : 0) + (usage.used_dinner ? 1 : 0);
  const daysLeft = Math.max(0, differenceInCalendarDays(end, now));

  return {
    status: "allowed", meal, member: memberInfo, planLabel: sub.planLabel,
    mealsUsedToday: used, mealsRemainingToday: Math.max(0, totalToday - used), daysRemainingInPlan: daysLeft,
  };
}
