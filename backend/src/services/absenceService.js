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

  // Fetch all dates with availed meals during the active subscription period
  const { rows } = await query(
    `SELECT date FROM meal_usage 
     WHERE member_id = $1 
       AND date BETWEEN $2::date AND $3::date 
       AND used_count > 0 
     ORDER BY date ASC`,
    [memberId, startStr, endStr]
  );

  // Set of formatted strings representing attended dates
  const attendedDates = new Set(rows.map(r => {
    // If PG returns date object, format it. If string, take substring
    const dObj = r.date instanceof Date ? r.date : new Date(r.date);
    return fmtDate(dObj);
  }));

  let consecutiveAbsent = 0;
  let totalCreditDays = 0;
  const streaks = [];
  let streakStart = null;

  for (let i = 0; i < totalDays; i++) {
    const currentDate = addDays(start, i);
    const dateStr = fmtDate(currentDate);

    if (!attendedDates.has(dateStr)) {
      // User was absent
      if (consecutiveAbsent === 0) {
        streakStart = currentDate;
      }
      consecutiveAbsent++;
    } else {
      // User attended - close active absent streak if it qualifies
      if (consecutiveAbsent > 3) {
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
  if (consecutiveAbsent > 3) {
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
  const { rows: memberRows } = await query(
    `SELECT sub_plan_id FROM members WHERE member_id = $1`,
    [memberId]
  );
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
