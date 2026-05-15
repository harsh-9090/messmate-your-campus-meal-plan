import { format, differenceInCalendarDays, parseISO } from "date-fns";
import { MealUsage } from "../models/MealUsage.js";
import { ScanLog } from "../models/ScanLog.js";
import { MealWindow } from "../models/MealWindow.js";

const todayStr = () => format(new Date(), "yyyy-MM-dd");
const fmt12 = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  const p = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${p}`;
};
const inWindow = (now, w) => {
  const cur = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = w.startTime.split(":").map(Number);
  const [eh, em] = w.endTime.split(":").map(Number);
  return cur >= sh * 60 + sm && cur <= eh * 60 + em;
};

/**
 * Strict 5-step validation. Persists usage and log atomically (best-effort).
 */
export async function validateAndRecord({ member, meal, scannedBy, deviceInfo }) {
  const date = todayStr();
  const log = (status, denialCode, denialReason) => ({
    memberId: member?.memberId, memberName: member?.name, meal, date,
    timestamp: new Date(), status, denialCode, denialReason, scannedBy, deviceInfo,
  });

  const memberInfo = member && { memberId: member.memberId, name: member.name, room: member.room };

  if (!member) {
    await ScanLog.create(log("denied", "NOT_FOUND", "Member not registered"));
    return { status: "denied", code: "NOT_FOUND", reason: "Member not registered", meal };
  }

  const sub = member.subscription || {};

  // STEP 1
  if (!sub.isPaid) {
    await ScanLog.create(log("denied", "UNPAID", "Subscription payment pending"));
    return { status: "denied", code: "UNPAID", reason: "Subscription payment pending", member: memberInfo, meal };
  }

  // STEP 2
  const now = new Date();
  const start = sub.startDate ? new Date(sub.startDate) : null;
  const end = sub.endDate ? new Date(sub.endDate) : null;
  if (!start || !end || now < start) {
    await ScanLog.create(log("denied", "EXPIRED", "Plan not yet active"));
    return { status: "denied", code: "EXPIRED", reason: "Plan not yet active", member: memberInfo, meal };
  }
  if (now > end) {
    const daysAgo = differenceInCalendarDays(now, end);
    const reason = `Plan expired ${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`;
    await ScanLog.create(log("denied", "EXPIRED", reason));
    return { status: "denied", code: "EXPIRED", reason, member: memberInfo, meal };
  }

  // STEP 3
  if (!sub.meals?.includes(meal)) {
    const reason = `${meal} is not included in your ${sub.planLabel} plan`;
    await ScanLog.create(log("denied", "NOT_IN_PLAN", reason));
    return { status: "denied", code: "NOT_IN_PLAN", reason, member: memberInfo, meal };
  }

  // STEP 4
  const w = await MealWindow.findOne({ meal, isActive: true });
  if (!w || !inWindow(now, w)) {
    const win = w ? `${fmt12(w.startTime)} – ${fmt12(w.endTime)}` : "not configured";
    const reason = `${meal} window is ${win}`;
    await ScanLog.create(log("denied", "WRONG_TIME", reason));
    return { status: "denied", code: "WRONG_TIME", reason, member: memberInfo, meal };
  }

  // STEP 5: atomic upsert with check
  const set = { [`usedMeals.${meal}`]: true };
  const filter = { memberId: member.memberId, date, [`usedMeals.${meal}`]: { $ne: true } };
  const updated = await MealUsage.findOneAndUpdate(
    filter,
    { $set: set, $inc: { usedCount: 1 }, $setOnInsert: { memberId: member.memberId, date } },
    { new: true, upsert: true }
  ).catch(async () => {
    // Likely duplicate: already used
    return null;
  });

  if (!updated || !updated.usedMeals[meal]) {
    const reason = `${meal} already scanned today`;
    await ScanLog.create(log("denied", "ALREADY_USED", reason));
    return { status: "denied", code: "ALREADY_USED", reason, member: memberInfo, meal };
  }

  await ScanLog.create(log("allowed"));
  const totalToday = sub.meals.length;
  const used = (updated.usedMeals.Breakfast ? 1 : 0) + (updated.usedMeals.Lunch ? 1 : 0) + (updated.usedMeals.Dinner ? 1 : 0);
  const daysLeft = Math.max(0, differenceInCalendarDays(end, now));

  return {
    status: "allowed", meal, member: memberInfo, planLabel: sub.planLabel,
    mealsUsedToday: used, mealsRemainingToday: Math.max(0, totalToday - used), daysRemainingInPlan: daysLeft,
  };
}
