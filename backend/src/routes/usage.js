import { Router } from "express";
import { format } from "date-fns";
import { verifyToken, requireRole } from "../middleware/authMiddleware.js";
import { query } from "../db/index.js";

const router = Router();
router.use(verifyToken);

router.get("/today", requireRole("admin"), async (_req, res, next) => {
  try {
    const date = format(new Date(), "yyyy-MM-dd");
    const { rows } = await query(`SELECT * FROM meal_usage WHERE date = $1`, [date]);
    res.json(rows.map((r) => ({
      memberId: r.member_id, date: format(r.date, "yyyy-MM-dd"),
      usedMeals: { Breakfast: r.used_breakfast, Lunch: r.used_lunch, Dinner: r.used_dinner },
      usedCount: r.used_count,
    })));
  } catch (e) { next(e); }
});

router.get("/summary/today", requireRole("admin", "staff"), async (_req, res, next) => {
  try {
    const date = format(new Date(), "yyyy-MM-dd");
    const { rows } = await query(
      `SELECT
         COALESCE(SUM(CASE WHEN used_breakfast THEN 1 ELSE 0 END),0)::int AS b,
         COALESCE(SUM(CASE WHEN used_lunch     THEN 1 ELSE 0 END),0)::int AS l,
         COALESCE(SUM(CASE WHEN used_dinner    THEN 1 ELSE 0 END),0)::int AS d
       FROM meal_usage WHERE date = $1`,
      [date]
    );
    const r = rows[0];
    res.json({ Breakfast: r.b, Lunch: r.l, Dinner: r.d, total: r.b + r.l + r.d });
  } catch (e) { next(e); }
});

router.get("/:memberId", async (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.user.sub !== req.params.memberId)
      return res.status(403).json({ error: "Forbidden" });
    const { from, to } = req.query;
    const where = [`member_id = $1`];
    const params = [req.params.memberId];
    if (from) { params.push(from); where.push(`date >= $${params.length}`); }
    if (to)   { params.push(to);   where.push(`date <= $${params.length}`); }
    const { rows } = await query(
      `SELECT * FROM meal_usage WHERE ${where.join(" AND ")} ORDER BY date DESC`,
      params
    );
    res.json(rows.map((r) => ({
      memberId: r.member_id, date: format(r.date, "yyyy-MM-dd"),
      usedMeals: { Breakfast: r.used_breakfast, Lunch: r.used_lunch, Dinner: r.used_dinner },
      usedCount: r.used_count,
    })));
  } catch (e) { next(e); }
});

export default router;
