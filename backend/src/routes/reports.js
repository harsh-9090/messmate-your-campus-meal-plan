import { Router } from "express";
import { format, addDays } from "date-fns";
import { verifyToken, requireRole } from "../middleware/authMiddleware.js";
import { query } from "../db/index.js";
import { toCsv } from "../services/reportService.js";
import { getCache, setCache } from "../db/redis.js";

const getISTDate = () => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * 5.5)); // Force UTC+5.30 (Indian Standard Time)
};

const router = Router();
router.use(verifyToken, requireRole("admin"));

router.get("/stats", async (_req, res, next) => {
  try {
    const { rows } = await query(`
      WITH ist_today AS (
        SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date as today
      )
      SELECT 
        -- Counts
        (SELECT COUNT(*)::int FROM members WHERE role = 'member' AND (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date = (SELECT today FROM ist_today)) as new_members,
        (SELECT COUNT(*)::int FROM members WHERE role = 'member' AND (sub_renewed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date = (SELECT today FROM ist_today) AND sub_renewal_count > 0) as renewed_members,
        (SELECT COUNT(*)::int FROM members WHERE role = 'member' AND sub_end_date = (SELECT today FROM ist_today)) as expired_members,
        (SELECT COALESCE(SUM(amount), 0)::int FROM payments WHERE (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date = (SELECT today FROM ist_today)) as collection,
        
        -- Details (as JSON arrays)
        (SELECT COALESCE(json_agg(m.*), '[]') FROM members m WHERE role = 'member' AND (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date = (SELECT today FROM ist_today)) as new_list,
        (SELECT COALESCE(json_agg(m.*), '[]') FROM members m WHERE role = 'member' AND (sub_renewed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date = (SELECT today FROM ist_today) AND sub_renewal_count > 0) as renewed_list,
        (SELECT COALESCE(json_agg(m.*), '[]') FROM members m WHERE role = 'member' AND sub_end_date = (SELECT today FROM ist_today)) as expired_list
    `);
    
    const { rowToMember, stripPassword } = await import("../db/index.js");
    const data = rows[0];
    
    // Transform raw DB rows to Member objects
    data.new_list = data.new_list.map(r => stripPassword(rowToMember(r)));
    data.renewed_list = data.renewed_list.map(r => stripPassword(rowToMember(r)));
    data.expired_list = data.expired_list.map(r => stripPassword(rowToMember(r)));
    
    res.json(data);
  } catch (e) { next(e); }
});

router.get("/daily", async (req, res, next) => {
  try {
    const today = format(getISTDate(), "yyyy-MM-dd");
    const date = req.query.date || today;
    
    const cacheKey = `messmate:report:daily:${date}`;
    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

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
    const result = {
      date,
      meals: { Breakfast: u.b, Lunch: u.l, Dinner: u.d },
      allowed, denied, total: allowed + denied, denialBreakdown,
    };
    
    // Cache for 5 mins if today, else 24 hours for past dates
    const ttl = date === today ? 300 : 86400;
    await setCache(cacheKey, result, ttl);
    
    res.json(result);
  } catch (e) { next(e); }
});

router.get("/weekly", async (_req, res, next) => {
  try {
    const cacheKey = "messmate:report:weekly";
    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    const days = Array.from({ length: 7 }, (_, i) => format(addDays(getISTDate(), -6 + i), "yyyy-MM-dd"));
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
    const result = { days: byDate, estimatedMonthlyRevenue: rev[0].r };
    await setCache(cacheKey, result, 600); // 10 min
    res.json(result);
  } catch (e) { next(e); }
});

router.get("/monthly", async (req, res, next) => {
  try {
    const month = req.query.month || format(getISTDate(), "yyyy-MM");
    const cacheKey = `messmate:report:monthly:${month}`;
    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    const { rows } = await query(
      `SELECT 
         COUNT(DISTINCT date)::int AS days,
         COALESCE(SUM(CASE WHEN used_breakfast THEN 1 ELSE 0 END),0)::int AS b,
         COALESCE(SUM(CASE WHEN used_lunch     THEN 1 ELSE 0 END),0)::int AS l,
         COALESCE(SUM(CASE WHEN used_dinner    THEN 1 ELSE 0 END),0)::int AS d
       FROM meal_usage WHERE to_char(date, 'YYYY-MM') = $1`,
      [month]
    );
    const u = rows[0];
    const result = {
      month,
      days: u.days,
      meals: { Breakfast: u.b, Lunch: u.l, Dinner: u.d },
      totalMeals: u.b + u.l + u.d
    };
    await setCache(cacheKey, result, 86400); // 24 hours
    res.json(result);
  } catch (e) { next(e); }
});

router.get("/yearly", async (req, res, next) => {
  try {
    const year = req.query.year || format(getISTDate(), "yyyy");
    const cacheKey = `messmate:report:yearly:${year}`;
    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    const { rows } = await query(
      `SELECT 
         COUNT(DISTINCT date)::int AS days,
         COALESCE(SUM(CASE WHEN used_breakfast THEN 1 ELSE 0 END),0)::int AS b,
         COALESCE(SUM(CASE WHEN used_lunch     THEN 1 ELSE 0 END),0)::int AS l,
         COALESCE(SUM(CASE WHEN used_dinner    THEN 1 ELSE 0 END),0)::int AS d
       FROM meal_usage WHERE to_char(date, 'YYYY') = $1`,
      [year]
    );
    const u = rows[0];
    const result = {
      year,
      days: u.days,
      meals: { Breakfast: u.b, Lunch: u.l, Dinner: u.d },
      totalMeals: u.b + u.l + u.d
    };
    await setCache(cacheKey, result, 86400); // 24 hours
    res.json(result);
  } catch (e) { next(e); }
});

router.get("/expiring", async (req, res, next) => {
  try {
    const days = parseInt(req.query.days || "7", 10);
    const cacheKey = `messmate:report:expiring:${days}`;
    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    const { rows } = await query(
      `SELECT * FROM members
         WHERE role = 'member' AND is_active = TRUE
           AND sub_end_date >= CURRENT_DATE
           AND sub_end_date <= CURRENT_DATE + ($1 || ' days')::interval`,
      [days]
    );
    const { rowToMember, stripPassword } = await import("../db/index.js");
    const result = rows.map((r) => stripPassword(rowToMember(r)));
    await setCache(cacheKey, result, 600, "report:expiring"); // 10 min, tracked in group
    res.json(result);
  } catch (e) { next(e); }
});

router.get("/denials", async (req, res, next) => {
  try {
    const date = req.query.date || format(getISTDate(), "yyyy-MM-dd");
    const cacheKey = `messmate:scan:denials:${date}`;
    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    const { rows } = await query(
      `SELECT denial_code, COUNT(*)::int AS c
         FROM scan_logs WHERE date = $1 AND status = 'denied'
         GROUP BY denial_code`,
      [date]
    );
    const grouped = {};
    let total = 0;
    for (const r of rows) { grouped[r.denial_code || "UNKNOWN"] = r.c; total += r.c; }
    const result = { date, total, breakdown: grouped };
    await setCache(cacheKey, result, 120); // 2 min
    res.json(result);
  } catch (e) { next(e); }
});

router.get("/export", async (req, res, next) => {
  try {
    const { type = "daily", format: fmt = "csv" } = req.query;
    let rowsOut = [];
    if (type === "daily") {
      const date = req.query.date || format(getISTDate(), "yyyy-MM-dd");
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

router.get("/finance", requireRole("admin"), async (req, res, next) => {
  try {
    const { period = "all", date = "" } = req.query; // period: day, month, year, all
    let where = "";
    const params = [];

    if (period === "day" && date) {
      params.push(date);
      where = `WHERE (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date = $${params.length}`;
    } else if (period === "month" && date) {
      params.push(date + "%"); // date: 2024-05
      where = `WHERE TO_CHAR(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM') LIKE $${params.length}`;
    } else if (period === "year" && date) {
      params.push(date + "%"); // date: 2024
      where = `WHERE TO_CHAR(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata', 'YYYY') LIKE $${params.length}`;
    }

    const { rows: summary } = await query(`
      SELECT 
        COALESCE(SUM(amount)::int, 0) as total_revenue,
        (SELECT COALESCE(SUM(sub_price_per_month - sub_amount_paid)::int, 0) FROM members WHERE role = 'member' AND sub_price_per_month > sub_amount_paid) as total_dues,
        COUNT(*)::int as tx_count
      FROM payments
      ${where}
    `, params);

    const { rows: monthly } = await query(`
      SELECT 
        TO_CHAR(date_trunc('month', created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata'), 'Mon YYYY') as month,
        SUM(amount)::int as revenue
      FROM payments
      ${where}
      GROUP BY 1
      ORDER BY MIN(created_at) DESC
      LIMIT 12
    `, params);

    const { rows: methods } = await query(`
      SELECT method as name, SUM(amount)::int as value
      FROM payments
      ${where}
      GROUP BY 1
      ORDER BY value DESC
    `, params);

    const { rows: plans } = await query(`
      SELECT 
        COALESCE(p.label, 'Custom') as name, 
        SUM(pay.amount)::int as value,
        (SELECT COUNT(*)::int FROM members m WHERE (m.sub_plan_id = pay.plan_id OR (m.sub_plan_id IS NULL AND pay.plan_id IS NULL)) AND m.is_active = TRUE) as members
      FROM payments pay
      LEFT JOIN plans p ON pay.plan_id = p.plan_id
      ${where.replace('created_at', 'pay.created_at')}
      GROUP BY 1, pay.plan_id
      ORDER BY value DESC
    `, params);

    res.json({
      summary: summary[0],
      monthly: monthly.reverse(),
      methods,
      plans
    });
  } catch (e) { next(e); }
});

export default router;
