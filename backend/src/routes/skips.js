import { Router } from "express";
import { query } from "../db/index.js";
import { verifyToken, requireRole } from "../middleware/authMiddleware.js";
import { format, addDays } from "date-fns";
import { delCache } from "../db/redis.js";

const router = Router();
router.use(verifyToken);

// Helper to format date object to YYYY-MM-DD
const formatDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// GET /skips -> Fetch skips for the logged-in member
router.get("/", requireRole("member"), async (req, res, next) => {
  try {
    const memberId = req.user.sub;
    const { startDate, endDate } = req.query;

    const start = startDate ? startDate : formatDate(new Date());
    const end = endDate ? endDate : formatDate(addDays(new Date(), 7));

    const { rows } = await query(
      `SELECT id, skip_date, meal, created_at
       FROM meal_skips
       WHERE member_id = $1 AND skip_date BETWEEN $2 AND $3
       ORDER BY skip_date ASC, CASE meal WHEN 'Breakfast' THEN 1 WHEN 'Lunch' THEN 2 WHEN 'Dinner' THEN 3 END`,
      [memberId, start, end]
    );

    res.json(rows.map(r => {
      let dStr = r.skip_date;
      if (dStr instanceof Date) {
        dStr = formatDate(dStr);
      }
      return {
        id: r.id,
        date: dStr,
        meal: r.meal,
        createdAt: r.created_at
      };
    }));
  } catch (e) {
    next(e);
  }
});

// POST /skips/toggle -> Toggle skip status (Breakfast/Lunch/Dinner) for a specific date
router.post("/toggle", requireRole("member"), async (req, res, next) => {
  try {
    const memberId = req.user.sub;
    const { date, meal, skip } = req.body;

    if (!date || !meal || typeof skip !== "boolean") {
      return res.status(400).json({ error: "date, meal, and skip (boolean) are required" });
    }

    if (!['Breakfast', 'Lunch', 'Dinner'].includes(meal)) {
      return res.status(400).json({ error: "Invalid meal type" });
    }

    // Verify member has this meal in their active subscription
    const memRes = await query(
      `SELECT sub_meals FROM members WHERE member_id = $1 AND is_active = TRUE`,
      [memberId]
    );
    if (memRes.rows.length === 0) {
      return res.status(404).json({ error: "Active member subscription not found" });
    }
    const subMeals = memRes.rows[0].sub_meals || [];
    if (!subMeals.includes(meal)) {
      return res.status(400).json({ error: `${meal} is not included in your subscription plan` });
    }

    // 12-hour cut-off rule validation
    const { rows: wRows } = await query(
      `SELECT start_time FROM meal_windows WHERE meal = $1 AND is_active = TRUE`,
      [meal]
    );
    const startTimeStr = wRows[0]?.start_time || (meal === "Breakfast" ? "07:00" : meal === "Lunch" ? "12:00" : "19:00");
    
    // Parse start time in Indian Standard Time (IST)
    const mealStartIST = new Date(`${date}T${startTimeStr}:00+05:30`);
    const now = new Date();

    const diffMs = mealStartIST.getTime() - now.getTime();
    const twelveHoursMs = 12 * 60 * 60 * 1000;

    if (diffMs < twelveHoursMs) {
      return res.status(400).json({
        error: "CUT_OFF_EXPIRED",
        message: `Cannot toggle skips within 12 hours of the meal window starting (${startTimeStr} IST)`
      });
    }

    if (skip) {
      await query(
        `INSERT INTO meal_skips (member_id, skip_date, meal)
         VALUES ($1, $2, $3)
         ON CONFLICT (member_id, skip_date, meal) DO NOTHING`,
        [memberId, date, meal]
      );
    } else {
      await query(
        `DELETE FROM meal_skips
         WHERE member_id = $1 AND skip_date = $2 AND meal = $3`,
        [memberId, date, meal]
      );
    }

    // Invalidate scan / usage cache
    await delCache([
      `messmate:usage:${memberId}:${date}`,
      `messmate:usage:summary:${date}`,
      `messmate:report:daily:${date}`
    ]);

    res.json({ ok: true, date, meal, skipped: skip });
  } catch (e) {
    next(e);
  }
});

// GET /skips/headcount -> Forecast headcount for the kitchen
router.get("/headcount", requireRole("staff", "admin"), async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? startDate : formatDate(new Date());
    const end = endDate ? endDate : formatDate(addDays(new Date(), 7));

    // Generate date range list in JS
    const dateList = [];
    let curDate = new Date(start);
    const stopDate = new Date(end);
    while (curDate <= stopDate) {
      dateList.push(formatDate(curDate));
      curDate.setDate(curDate.getDate() + 1);
    }

    const report = [];

    for (const d of dateList) {
      const dayData = {
        date: d,
        meals: {
          Breakfast: { activeSubscribers: 0, skips: 0, expectedPortions: 0 },
          Lunch: { activeSubscribers: 0, skips: 0, expectedPortions: 0 },
          Dinner: { activeSubscribers: 0, skips: 0, expectedPortions: 0 }
        }
      };

      for (const meal of ["Breakfast", "Lunch", "Dinner"]) {
        // Count active subscribers for this meal on this date
        const subCountRes = await query(
          `SELECT COUNT(*)::integer AS count
           FROM members
           WHERE role = 'member' AND is_active = TRUE
             AND $1 = ANY(sub_meals)
             AND sub_start_date <= $2 AND sub_end_date >= $2`,
          [meal, d]
        );
        const activeSubscribers = subCountRes.rows[0]?.count || 0;

        // Count skips for this meal on this date
        const skipCountRes = await query(
          `SELECT COUNT(*)::integer AS count
           FROM meal_skips
           WHERE skip_date = $1 AND meal = $2`,
          [d, meal]
        );
        const skips = skipCountRes.rows[0]?.count || 0;

        dayData.meals[meal] = {
          activeSubscribers,
          skips,
          expectedPortions: Math.max(0, activeSubscribers - skips)
        };
      }

      report.push(dayData);
    }

    res.json(report);
  } catch (e) {
    next(e);
  }
});

export default router;
