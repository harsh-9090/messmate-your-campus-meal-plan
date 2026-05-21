import { differenceInCalendarDays, addDays, format, parseISO } from "date-fns";
import { query } from "../db/index.js";

const fmtDate = (d) => format(d, "yyyy-MM-dd");

/**
 * Calculates member absence credits based on their current active subscription period.
 * Strict Interpretation A: If user is absent for >3 days in a row, the entire streak length is credited.
 * 
 * @param {string} memberId 
 * @param {string|Date} startDate 
 * @param {string|Date} endDate 
 * @returns {Promise<{ totalCreditDays: number, streaks: Array<{ start: string, end: string, length: number, credit: number }> }>}
 */
export async function calculateAbsenceCredits(memberId, startDate, endDate) {
  if (!startDate || !endDate) {
    return { totalCreditDays: 0, streaks: [] };
  }

  const startStr = typeof startDate === "string" ? startDate : fmtDate(startDate);
  const endStr = typeof endDate === "string" ? endDate : fmtDate(endDate);

  const start = parseISO(startStr);
  const end = parseISO(endStr);
  const totalDays = differenceInCalendarDays(end, start) + 1;

  if (totalDays <= 0) {
    return { totalCreditDays: 0, streaks: [] };
  }

  // Fetch member sub_meals and sub_plan_id
  const { rows: memberRows } = await query(
    `SELECT sub_meals, sub_plan_id FROM members WHERE member_id = $1`,
    [memberId]
  );

  let subMeals = [];
  if (memberRows[0]?.sub_meals) {
    if (Array.isArray(memberRows[0].sub_meals)) {
      subMeals = memberRows[0].sub_meals;
    } else if (typeof memberRows[0].sub_meals === "string") {
      subMeals = memberRows[0].sub_meals.replace(/[{}]/g, "").split(",").filter(Boolean);
    }
  }

  // Fetch all pre-registered meal skips during the active subscription period
  const { rows: skipRows } = await query(
    `SELECT skip_date, meal FROM meal_skips 
     WHERE member_id = $1 
       AND skip_date BETWEEN $2::date AND $3::date 
     ORDER BY skip_date ASC`,
    [memberId, startStr, endStr]
  );

  // Group skips by date
  const skipsByDate = {};
  for (const r of skipRows) {
    const dObj = r.skip_date instanceof Date ? r.skip_date : new Date(r.skip_date);
    const dStr = fmtDate(dObj);
    if (!skipsByDate[dStr]) {
      skipsByDate[dStr] = [];
    }
    skipsByDate[dStr].push(r.meal);
  }

  let consecutiveAbsent = 0;
  let totalCreditDays = 0;
  const streaks = [];
  let streakStart = null;

  for (let i = 0; i < totalDays; i++) {
    const currentDate = addDays(start, i);
    const dateStr = fmtDate(currentDate);

    const daySkips = skipsByDate[dateStr] || [];
    // Day counts as absent only if member skipped all subscribed meals
    const hasSkippedAll = subMeals.length > 0 && subMeals.every(m => daySkips.includes(m));

    if (hasSkippedAll) {
      if (consecutiveAbsent === 0) {
        streakStart = currentDate;
      }
      consecutiveAbsent++;
    } else {
      // Close active absent streak if it qualifies (>= 3 consecutive days)
      if (consecutiveAbsent >= 3) {
        const credit = consecutiveAbsent; // Interpretation A
        totalCreditDays += credit;
        streaks.push({
          start: fmtDate(streakStart),
          end: fmtDate(addDays(streakStart, consecutiveAbsent - 1)),
          length: consecutiveAbsent,
          credit
        });
      }
      consecutiveAbsent = 0;
      streakStart = null;
    }
  }

  // Handle final day streak
  if (consecutiveAbsent >= 3) {
    const credit = consecutiveAbsent; // Interpretation A
    totalCreditDays += credit;
    streaks.push({
      start: fmtDate(streakStart),
      end: fmtDate(addDays(streakStart, consecutiveAbsent - 1)),
      length: consecutiveAbsent,
      credit
    });
  }

  // Fetch member's plan duration to enforce strict capping
  let durationMonths = 1;
  if (memberRows[0]?.sub_plan_id) {
    const { rows: planRows } = await query(
      `SELECT duration_months FROM plans WHERE plan_id = $1`,
      [memberRows[0].sub_plan_id]
    );
    if (planRows[0]) {
      durationMonths = planRows[0].duration_months;
    }
  }
  const maxCredits = durationMonths * 30;

  // Cap streaks and adjust end dates if they exceed plan duration
  for (const s of streaks) {
    if (s.length > maxCredits) {
      s.length = maxCredits;
      s.credit = maxCredits;
      const sStart = parseISO(s.start);
      s.end = fmtDate(addDays(sStart, maxCredits - 1));
    }
  }

  totalCreditDays = Math.min(totalCreditDays, maxCredits);

  return { totalCreditDays, streaks };
}
