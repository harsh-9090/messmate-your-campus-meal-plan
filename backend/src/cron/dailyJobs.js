import cron from "node-cron";
import { differenceInCalendarDays, format } from "date-fns";
import { query, rowToMember } from "../db/index.js";
import { queueEmailJob, queuePushJob } from "../queues/notificationQueue.js";
import { delCache, delByPattern } from "../db/redis.js";

const getISTDate = () => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * 5.5)); // Force UTC+5.30 (Indian Standard Time)
};

export async function runDailyTasks() {
  console.log("[CRON] Running daily jobs…");
  const todayStr = format(getISTDate(), "yyyy-MM-dd");

  await delCache([
    `messmate:usage:summary:${todayStr}`,
    `messmate:scan:log:${todayStr}`,
    `messmate:scan:denials:${todayStr}`,
    "messmate:report:weekly"
  ]);
  await delByPattern("report:expiring");

  const { rows: soon } = await query(
    `SELECT * FROM members
      WHERE role = 'member' AND is_active = TRUE
        AND sub_end_date BETWEEN CURRENT_DATE + INTERVAL '2 day' AND CURRENT_DATE + INTERVAL '3 day'`
  );
  for (const r of soon) {
    const m = rowToMember(r);
    const daysLeft = differenceInCalendarDays(new Date(m.subscription.endDate), getISTDate());
    await queueEmailJob("expiring_soon", { member: m, daysLeft });
    await queuePushJob("member", {
      memberId: m.memberId,
      payload: {
        title: "Subscription Expiring Soon ⚠️",
        body: `Your meal plan subscription expires in ${daysLeft} days (on ${m.subscription.endDate}). Please visit the mess office to renew.`,
        url: "/dashboard",
      }
    });
  }

  const { rows: gone } = await query(
    `SELECT * FROM members
      WHERE role = 'member' AND is_active = TRUE
        AND sub_end_date >= CURRENT_DATE - INTERVAL '1 day'
        AND sub_end_date <  CURRENT_DATE`
  );
  for (const r of gone) {
    await queueEmailJob("expired", { member: rowToMember(r) });
  }

  console.log(`[CRON] Done. expiringSoon=${soon.length} expiredToday=${gone.length}`);
  return { expiringSoon: soon.length, expired: gone.length };
}

export async function sendDailySummaryEmail() {
  console.log("[CRON] Generating Daily Summary Email…");
  const todayStr = format(getISTDate(), "yyyy-MM-dd");

  const { rows: logs } = await query(
    `SELECT meal, diet_served, COUNT(*)::int AS count
     FROM scan_logs 
     WHERE date = $1 AND status = 'allowed'
     GROUP BY meal, diet_served`,
    [todayStr]
  );

  const breakdown = {
    Breakfast: { total: 0, Veg: 0, "Non-Veg": 0 },
    Lunch: { total: 0, Veg: 0, "Non-Veg": 0 },
    Dinner: { total: 0, Veg: 0, "Non-Veg": 0 }
  };

  let totalPlates = 0;
  for (const r of logs) {
    if (!breakdown[r.meal]) continue;
    const diet = r.diet_served || "Veg";
    breakdown[r.meal][diet] = (breakdown[r.meal][diet] || 0) + r.count;
    breakdown[r.meal].total += r.count;
    totalPlates += r.count;
  }

  // Fetch all active admins
  const { rows: admins } = await query(
    `SELECT email FROM members WHERE role = 'admin' AND is_active = TRUE AND email IS NOT NULL`
  );

  if (admins.length === 0) {
    console.log("[CRON] No active admins found with email, skipping summary email.");
    return { plates: totalPlates, adminsNotified: 0 };
  }

  for (const a of admins) {
    if (!a.email) continue;
    await queueEmailJob("daily_summary", {
      email: a.email,
      date: todayStr,
      totalPlates,
      breakdown
    });
  }

  console.log(`[CRON] Daily Summary sent to ${admins.length} admins. Total Plates: ${totalPlates}`);
  return { plates: totalPlates, adminsNotified: admins.length };
}

export async function sendBirthdayEmails() {
  console.log("[CRON] Checking for today's birthdays…");
  
  const { rows: birthdays } = await query(
    `SELECT * FROM members 
     WHERE EXTRACT(MONTH FROM dob::date) = EXTRACT(MONTH FROM CURRENT_DATE) 
       AND EXTRACT(DAY FROM dob::date) = EXTRACT(DAY FROM CURRENT_DATE)
       AND is_active = TRUE`
  );

  if (birthdays.length === 0) {
    console.log("[CRON] No birthdays today.");
    return { count: 0 };
  }

  for (const r of birthdays) {
    const member = rowToMember(r);
    await queueEmailJob("birthday_wish", { member });
  }

  console.log(`[CRON] Queued ${birthdays.length} birthday emails.`);
  return { count: birthdays.length };
}

export function startCron() {
  // Only auto-run node-cron scheduler in local development/non-production env
  // if not triggered externally.
  if (process.env.NODE_ENV === "production") {
    console.log("[CRON] Production detected. node-cron scheduler disabled in-process (using external webhook).");
    return;
  }
  
  cron.schedule("1 0 * * *", async () => {
    try {
      await runDailyTasks();
    } catch (err) {
      console.error("[CRON-ERROR] Failed to run daily tasks in node-cron:", err);
    }
  });
  console.log("✓ Local cron scheduled (00:01 daily)");
}
