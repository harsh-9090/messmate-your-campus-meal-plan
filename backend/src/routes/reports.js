import { Router } from "express";
import { format, addDays } from "date-fns";
import { verifyToken, requireRole } from "../middleware/authMiddleware.js";
import { query } from "../db/index.js";
import { toCsv } from "../services/reportService.js";

const router = Router();
router.use(verifyToken, requireRole("admin"));

router.get("/daily", async (req, res, next) => {
  try {
    const date = req.query.date || format(new Date(), "yyyy-MM-dd");
    const [usage, logs] = await Promise.all([
      query(
        `SELECT
           COALESCE(SUM(CASE WHEN used_breakfast THEN 1 ELSE 0 END),0)::int AS b,
           COALESCE(SUM(CASE WHEN used_lunch     THEN 1 ELSE 0 END),0)::int AS l,
           COALESCE(SUM(CASE WHEN used_dinner    THEN 1 ELSE 0 END),0)::int AS d
         FROM meal_usage WHERE date = $1`,
        [date]
      ),
      query(
        `SELECT status, denial_code, COUNT(*)::int AS c
         FROM scan_logs WHERE date = $1 GROUP BY status, denial_code`,
        [date]
      ),
    ]);
    const u = usage.rows[0];
    let allowed = 0, denied = 0;
    const denialBreakdown = {};
    for (const r of logs.rows) {
      if (r.status === "allowed") allowed += r.c;
      else { denied += r.c; if (r.denial_code) denialBreakdown[r.denial_code] = (denialBreakdown[r.denial_code] || 0) + r.c; }
    }
    res.json({
      date,
      meals: { Breakfast: u.b, Lunch: u.l, Dinner: u.d },
      allowed, denied, total: allowed + denied, denialBreakdown,
    });
  } catch (e) { next(e); }
});

router.get("/weekly", async (_req, res, next) => {
  try {
    const days = Array.from({ length: 7 }, (_, i) => format(addDays(new Date(), -6 + i), "yyyy-MM-dd"));
    const { rows: usage } = await query(
      `SELECT date,
              SUM(CASE WHEN used_breakfast THEN 1 ELSE 0 END +
                  CASE WHEN used_lunch     THEN 1 ELSE 0 END +
                  CASE WHEN used_dinner    THEN 1 ELSE 0 END)::int AS meals
         FROM meal_usage WHERE date = ANY($1::date[]) GROUP BY date`,
      [days]
    );
    const byDateMap = new Map(usage.map((u) => [format(u.date, "yyyy-MM-dd"), u.meals]));
    const byDate = days.map((d) => ({ date: d, meals: byDateMap.get(d) || 0 }));
    const { rows: rev } = await query(
      `SELECT COALESCE(SUM(sub_price_per_month),0)::int AS r
         FROM members
         WHERE role = 'member' AND is_active = TRUE AND sub_is_paid = TRUE
           AND sub_end_date >= CURRENT_DATE`
    );
    res.json({ days: byDate, estimatedMonthlyRevenue: rev[0].r });
  } catch (e) { next(e); }
});

router.get("/monthly", async (req, res, next) => {
  try {
    const month = req.query.month || format(new Date(), "yyyy-MM");
    const { rows } = await query(
      `SELECT COUNT(*)::int AS days, COALESCE(SUM(used_count),0)::int AS total
         FROM meal_usage WHERE to_char(date, 'YYYY-MM') = $1`,
      [month]
    );
    res.json({ month, totalMeals: rows[0].total, days: rows[0].days });
  } catch (e) { next(e); }
});

router.get("/expiring", async (req, res, next) => {
  try {
    const days = parseInt(req.query.days || "7", 10);
    const { rows } = await query(
      `SELECT * FROM members
         WHERE role = 'member' AND is_active = TRUE
           AND sub_end_date >= CURRENT_DATE
           AND sub_end_date <= CURRENT_DATE + ($1 || ' days')::interval`,
      [days]
    );
    const { rowToMember, stripPassword } = await import("../db/index.js");
    res.json(rows.map((r) => stripPassword(rowToMember(r))));
  } catch (e) { next(e); }
});

router.get("/denials", async (req, res, next) => {
  try {
    const date = req.query.date || format(new Date(), "yyyy-MM-dd");
    const { rows } = await query(
      `SELECT denial_code, COUNT(*)::int AS c
         FROM scan_logs WHERE date = $1 AND status = 'denied'
         GROUP BY denial_code`,
      [date]
    );
    const grouped = {};
    let total = 0;
    for (const r of rows) { grouped[r.denial_code || "UNKNOWN"] = r.c; total += r.c; }
    res.json({ date, total, breakdown: grouped });
  } catch (e) { next(e); }
});

router.get("/export", async (req, res, next) => {
  try {
    const { type = "daily", format: fmt = "csv" } = req.query;
    let rowsOut = [];
    if (type === "daily") {
      const date = req.query.date || format(new Date(), "yyyy-MM-dd");
      const { rows } = await query(
        `SELECT date, ts, member_id, member_name, meal, status, denial_code, denial_reason
           FROM scan_logs WHERE date = $1 ORDER BY ts ASC`,
        [date]
      );
      rowsOut = rows.map((l) => ({
        date: format(l.date, "yyyy-MM-dd"),
        time: l.ts,
        memberId: l.member_id,
        memberName: l.member_name,
        meal: l.meal,
        status: l.status,
        code: l.denial_code || "",
        reason: l.denial_reason || "",
      }));
    }
    if (fmt === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="messmate-${type}.csv"`);
      return res.send(toCsv(rowsOut));
    }
    res.json(rowsOut);
  } catch (e) { next(e); }
});

export default router;
