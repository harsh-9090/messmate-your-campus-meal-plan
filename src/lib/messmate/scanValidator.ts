import type { Member, Meal, MealWindow, ScanResult, MealUsageDay } from "./types";
import { todayISO, daysRemaining, isWithinWindow, formatTime12h } from "./dateHelpers";
import { parseISO, differenceInCalendarDays } from "date-fns";

/**
 * 5-step strict validation. Mirrors backend logic exactly.
 */
export function validateScan(args: {
  member: Member | null;
  meal: Meal;
  windows: MealWindow[];
  usage: MealUsageDay | null;
  now?: Date;
}): ScanResult {
  const { member, meal, windows, usage, now = new Date() } = args;

  if (!member) {
    return { status: "denied", meal, code: "NOT_FOUND", reason: "Member not registered" };
  }

  const memberInfo = {
    memberId: member.memberId,
    name: member.name,
    room: member.room,
    photoUrl: member.photoUrl,
  };
  const sub = member.subscription;

  // STEP 1 — payment
  if (!sub.isPaid) {
    return {
      status: "denied",
      meal,
      member: memberInfo,
      code: "UNPAID",
      reason: "Subscription payment pending",
    };
  }

  // STEP 2 — expiry
  const today = todayISO();
  if (today < sub.startDate) {
    return {
      status: "denied",
      meal,
      member: memberInfo,
      code: "EXPIRED",
      reason: "Plan not yet active",
    };
  }
  if (today > sub.endDate) {
    const daysAgo = differenceInCalendarDays(new Date(), parseISO(sub.endDate));
    return {
      status: "denied",
      meal,
      member: memberInfo,
      code: "EXPIRED",
      reason: `Plan expired ${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`,
    };
  }

  // STEP 3 — meal in plan
  if (!sub.meals.includes(meal)) {
    return {
      status: "denied",
      meal,
      member: memberInfo,
      code: "NOT_IN_PLAN",
      reason: `${meal} is not included in your ${sub.planLabel} plan`,
    };
  }

  // STEP 4 — time window
  const w = windows.find((x) => x.meal === meal);
  if (!w || !isWithinWindow(now, w)) {
    const win = w ? `${formatTime12h(w.startTime)} – ${formatTime12h(w.endTime)}` : "not configured";
    return {
      status: "denied",
      meal,
      member: memberInfo,
      code: "WRONG_TIME",
      reason: `${meal} window is ${win}`,
    };
  }

  // STEP 5 — duplicate
  if (usage?.usedMeals[meal]) {
    return {
      status: "denied",
      meal,
      member: memberInfo,
      code: "ALREADY_USED",
      reason: `${meal} already scanned today`,
    };
  }

  // ALLOWED — compute live counters
  const usedAfter = (usage?.usedMeals.Breakfast ? 1 : 0) +
                    (usage?.usedMeals.Lunch ? 1 : 0) +
                    (usage?.usedMeals.Dinner ? 1 : 0) + 1;
  const totalToday = sub.meals.length;

  return {
    status: "allowed",
    meal,
    member: memberInfo,
    planLabel: sub.planLabel,
    mealsUsedToday: usedAfter,
    mealsRemainingToday: Math.max(0, totalToday - usedAfter),
    daysRemainingInPlan: Math.max(0, daysRemaining(sub.endDate)),
  };
}
