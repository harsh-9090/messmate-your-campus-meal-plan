import { Router } from "express";
import { query } from "../db/index.js";
import { verifyToken, requireRole } from "../middleware/authMiddleware.js";
import { format, subDays } from "date-fns";

const router = Router();
router.use(verifyToken);

const fmtDate = (d) => format(d, "yyyy-MM-dd");

// GET /ratings/status -> Fetch eaten but unrated meals for today and yesterday
router.get("/status", async (req, res, next) => {
  try {
    const today = new Date();
    const todayStr = fmtDate(today);
    const yesterdayStr = fmtDate(subDays(today, 1));

    // 1. Fetch member usage
    const { rows: usageRows } = await query(
      `SELECT date, used_breakfast, used_lunch, used_dinner FROM meal_usage 
       WHERE member_id = $1 AND date BETWEEN $2::date AND $3::date`,
      [req.user.id, yesterdayStr, todayStr]
    );

    // 2. Fetch existing ratings
    const { rows: ratingRows } = await query(
      `SELECT DISTINCT date, meal FROM menu_item_ratings 
       WHERE member_id = $1 AND date BETWEEN $2::date AND $3::date`,
      [req.user.id, yesterdayStr, todayStr]
    );

    // 3. Fetch menus
    const { rows: menuRows } = await query(
      `SELECT date, meal, items FROM menus 
       WHERE date BETWEEN $1::date AND $2::date`,
      [yesterdayStr, todayStr]
    );

    const ratedKeys = new Set(ratingRows.map(r => {
      const dObj = r.date instanceof Date ? r.date : new Date(r.date);
      return `${fmtDate(dObj)}:${r.meal}`;
    }));

    const menusMap = {};
    menuRows.forEach(r => {
      const dObj = r.date instanceof Date ? r.date : new Date(r.date);
      menusMap[`${fmtDate(dObj)}:${r.meal}`] = r.items;
    });

    const unrated = [];

    usageRows.forEach(row => {
      const dObj = row.date instanceof Date ? row.date : new Date(row.date);
      const dStr = fmtDate(dObj);

      const meals = [
        { name: "Breakfast", eaten: row.used_breakfast },
        { name: "Lunch", eaten: row.used_lunch },
        { name: "Dinner", eaten: row.used_dinner }
      ];

      meals.forEach(m => {
        if (m.eaten) {
          const key = `${dStr}:${m.name}`;
          if (!ratedKeys.has(key) && menusMap[key]) {
            unrated.push({
              date: dStr,
              meal: m.name,
              items: menusMap[key]
            });
          }
        }
      });
    });

    res.json(unrated);
  } catch (e) { next(e); }
});

// POST /ratings -> Submit ratings for a meal
router.post("/", async (req, res, next) => {
  try {
    const { date, meal, ratings, comments = "", is_anonymous = false } = req.body;

    if (!date || !meal || !Array.isArray(ratings) || ratings.length === 0) {
      return res.status(400).json({ error: "date, meal, and ratings list are required" });
    }

    // Insert each dish rating
    for (const r of ratings) {
      const { dish_name, rating } = r;
      if (!dish_name || !rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Invalid rating value" });
      }

      await query(
        `INSERT INTO menu_item_ratings (member_id, date, meal, dish_name, rating, comments, is_anonymous, created_at)
         VALUES ($1, $2::date, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (member_id, date, meal, dish_name)
         DO UPDATE SET rating = EXCLUDED.rating, comments = EXCLUDED.comments, is_anonymous = EXCLUDED.is_anonymous`,
        [req.user.id, date, meal, dish_name, rating, comments, is_anonymous]
      );
    }

    res.json({ ok: true });
  } catch (e) { next(e); }
});

// GET /ratings/analytics -> Get food feedback analytics (Admin/Staff only)
router.get("/analytics", requireRole(["admin", "staff"]), async (req, res, next) => {
  try {
    // 1. Fetch stats per dish
    const { rows: dishStats } = await query(`
      SELECT 
        dish_name,
        ROUND(AVG(rating)::numeric, 1)::float as avg_rating,
        COUNT(*)::int as total_ratings,
        COUNT(CASE WHEN rating = 1 THEN 1 END)::int as r1,
        COUNT(CASE WHEN rating = 2 THEN 1 END)::int as r2,
        COUNT(CASE WHEN rating = 3 THEN 1 END)::int as r3,
        COUNT(CASE WHEN rating = 4 THEN 1 END)::int as r4,
        COUNT(CASE WHEN rating = 5 THEN 1 END)::int as r5
      FROM menu_item_ratings
      GROUP BY dish_name
      ORDER BY avg_rating DESC, total_ratings DESC
    `);

    // 2. Fetch recent comment feeds
    const { rows: commentRows } = await query(`
      SELECT 
        r.id,
        r.date,
        r.meal,
        r.dish_name,
        r.rating,
        r.comments,
        r.is_anonymous,
        r.created_at,
        CASE WHEN r.is_anonymous THEN NULL ELSE m.name END as member_name
      FROM menu_item_ratings r
      LEFT JOIN members m ON r.member_id = m.member_id
      WHERE r.comments IS NOT NULL AND r.comments <> ''
      ORDER BY r.created_at DESC
      LIMIT 100
    `);

    res.json({
      dishes: dishStats.map(d => ({
        dish_name: d.dish_name,
        avg_rating: d.avg_rating,
        total_ratings: d.total_ratings,
        breakdown: { 1: d.r1, 2: d.r2, 3: d.r3, 4: d.r4, 5: d.r5 }
      })),
      comments: commentRows.map(c => {
        let dStr = c.date;
        if (dStr instanceof Date) {
          const y = dStr.getFullYear();
          const m = String(dStr.getMonth() + 1).padStart(2, '0');
          const d = String(dStr.getDate()).padStart(2, '0');
          dStr = `${y}-${m}-${d}`;
        }
        return {
          id: c.id,
          date: dStr,
          meal: c.meal,
          dish_name: c.dish_name,
          rating: c.rating,
          comments: c.comments,
          is_anonymous: c.is_anonymous,
          memberName: c.member_name || "Anonymous",
          createdAt: c.created_at
        };
      })
    });
  } catch (e) { next(e); }
});

export default router;
