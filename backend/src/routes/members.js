import { Router } from "express";
import bcrypt from "bcrypt";
import { addDays, addMonths, format } from "date-fns";
import { body, validationResult } from "express-validator";
import { query, rowToMember, stripPassword } from "../db/index.js";
import { verifyToken, requireRole } from "../middleware/authMiddleware.js";
import { getCache, setCache, delCache, delByPattern } from "../db/redis.js";
import { nextMemberId } from "../services/memberIdService.js";

const router = Router();
router.use(verifyToken);

const fmtDate = (d) => format(d, "yyyy-MM-dd");

// list (admin)
router.get("/", requireRole("admin"), async (req, res, next) => {
  try {
    const { search = "", status, page = 1, limit = 20 } = req.query;
    const cacheKey = `messmate:member:list:${page}:${limit}:${search}:${status || "all"}`;
    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    const where = [`is_active = TRUE`, `role = 'member'`];
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      where.push(`(name ILIKE $${params.length} OR member_id ILIKE $${params.length})`);
    }
    const today = fmtDate(new Date());
    if (status === "expired") where.push(`sub_end_date < DATE '${today}'`);
    if (status === "unpaid") where.push(`sub_is_paid = FALSE`);
    if (status === "active") where.push(`sub_is_paid = TRUE AND sub_end_date >= DATE '${today}'`);

    const whereSql = `WHERE ${where.join(" AND ")}`;
    const lim = parseInt(limit, 10), pg = parseInt(page, 10);
    const offset = (pg - 1) * lim;
    params.push(lim, offset);

    const [items, total] = await Promise.all([
      query(`SELECT * FROM members ${whereSql} ORDER BY member_id ASC LIMIT $${params.length - 1} OFFSET $${params.length}`, params),
      query(`SELECT COUNT(*)::int AS c FROM members ${whereSql}`, params.slice(0, -2)),
    ]);
    const result = {
      items: items.rows.map((r) => stripPassword(rowToMember(r))),
      total: total.rows[0].c, page: pg, limit: lim,
    };
    await setCache(cacheKey, result, 120, "member:list"); // 2 min, tracked in group
    res.json(result);
  } catch (e) { next(e); }
});

router.get("/:id", async (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.user.sub !== req.params.id)
      return res.status(403).json({ error: "Forbidden" });
    
    const cacheKey = `messmate:member:${req.params.id}`;
    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    const { rows } = await query(`SELECT * FROM members WHERE member_id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    
    const result = stripPassword(rowToMember(rows[0]));
    await setCache(cacheKey, result, 600); // 10 min
    res.json(result);
  } catch (e) { next(e); }
});

router.post("/",
  requireRole("admin"),
  body("name").isString().trim().notEmpty(),
  body("email").isEmail(),
  body("password").isString().isLength({ min: 6 }),
  body("planId").isString(),
  body("meals").isArray({ min: 1 }),
  body("startDate").isISO8601(),
  async (req, res, next) => {
    try {
      const errs = validationResult(req);
      if (!errs.isEmpty()) return res.status(400).json({ error: "Invalid input", details: errs.array() });
      const { name, email, password, mobile = null, planId, meals, startDate, amountPaid = 0, paymentMethod = "Cash", role = "member" } = req.body;

      const plan = (await query(`SELECT * FROM plans WHERE plan_id = $1`, [planId])).rows[0];
      const start = new Date(startDate);
      const duration = plan?.duration_months ?? 1;
      const end = addMonths(start, duration);
      const id = await nextMemberId();
      const hash = await bcrypt.hash(password, 12);

      const pricePerMonth = plan?.price_per_month ?? 0;
      const isPaid = amountPaid >= pricePerMonth && pricePerMonth > 0;

      const { rows } = await query(
        `INSERT INTO members
         (member_id, name, email, mobile, password_hash, role, is_active,
          sub_plan_id, sub_plan_label, sub_meals, sub_start_date, sub_end_date,
          sub_is_paid, sub_paid_at, sub_price_per_month, sub_amount_paid, sub_renewal_count)
         VALUES ($1,$2,$3,$4,$5,$6,TRUE,$7,$8,$9,$10,$11,$12,$13,$14,$15,0)
         RETURNING *`,
        [id, name, email, mobile, hash, role,
          planId, plan?.label ?? "Custom", meals, fmtDate(start), fmtDate(end),
          isPaid, isPaid ? new Date() : null, pricePerMonth, amountPaid]
      );
      
      await delByPattern("member:list");
      const m = rows[0];
      if (amountPaid > 0) {
        await query(
          `INSERT INTO payments (member_id, amount, method, type, plan_id) VALUES ($1,$2,$3,'initial',$4)`,
          [id, amountPaid, paymentMethod, planId]
        );
      }
      res.status(201).json(stripPassword(rowToMember(m)));
    } catch (e) { next(e); }
  });

router.put("/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const allowed = { name: "name", email: "email", mobile: "mobile", role: "role", photoUrl: "photo_url" };
    const sets = [];
    const params = [];
    for (const [k, col] of Object.entries(allowed)) {
      if (k in req.body) { params.push(req.body[k]); sets.push(`${col} = $${params.length}`); }
    }
    if (req.body.password) {
      params.push(await bcrypt.hash(req.body.password, 12));
      sets.push(`password_hash = $${params.length}`);
    }
    if (!sets.length) return res.status(400).json({ error: "No updatable fields" });
    sets.push(`updated_at = NOW()`);
    params.push(req.params.id);
    const { rows } = await query(
      `UPDATE members SET ${sets.join(", ")} WHERE member_id = $${params.length} RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    
    await delCache([`messmate:member:${req.params.id}`, `messmate:member:${req.params.id}:subscription`]);
    await delByPattern("member:list");
    
    res.json(stripPassword(rowToMember(rows[0])));
  } catch (e) { next(e); }
});

router.delete("/:id", requireRole("admin"), async (req, res, next) => {
  try {
    await query(`DELETE FROM members WHERE member_id = $1`, [req.params.id]);
    
    await delCache([`messmate:member:${req.params.id}`, `messmate:member:${req.params.id}:subscription`]);
    await delByPattern("member:list");
    
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.put("/:id/renew", requireRole("admin"), async (req, res, next) => {
  try {
    const today = new Date();
    const { planId = null, amountPaid = 0, paymentMethod = "Cash" } = req.body;
    
    // Fetch current or new plan
    const targetPlanId = planId || (await query(`SELECT sub_plan_id FROM members WHERE member_id = $1`, [req.params.id])).rows[0]?.sub_plan_id;
    const plan = (await query(`SELECT * FROM plans WHERE plan_id = $1`, [targetPlanId])).rows[0];
    
    const duration = plan?.duration_months ?? 1;
    const price = plan?.price_per_month ?? 0;
    const end = addMonths(today, duration);
    const isPaid = amountPaid >= price && price > 0;

    const { rows } = await query(
      `UPDATE members SET 
         sub_plan_id = $1, sub_plan_label = $2, sub_meals = $3,
         sub_start_date = $4, sub_end_date = $5, 
         sub_is_paid = $6, sub_price_per_month = $7, sub_amount_paid = $8,
         sub_renewed_at = NOW(), sub_renewal_count = sub_renewal_count + 1,
         sub_paid_at = CASE WHEN $6 THEN NOW() ELSE sub_paid_at END, 
         updated_at = NOW()
       WHERE member_id = $9 RETURNING *`,
      [plan?.plan_id, plan?.label, plan?.meals || "{}", fmtDate(today), fmtDate(end), isPaid, price, amountPaid, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });

    if (amountPaid > 0) {
      await query(
        `INSERT INTO payments (member_id, amount, method, type, plan_id) VALUES ($1,$2,$3,'renewal',$4)`,
        [req.params.id, amountPaid, paymentMethod, plan?.plan_id]
      );
    }
    
    await delCache([`messmate:member:${req.params.id}`, `messmate:member:${req.params.id}:subscription`, `messmate:report:weekly`]);
    await delByPattern("member:list");
    await delByPattern("report:expiring");
    
    res.json(rowToMember(rows[0]).subscription);
  } catch (e) { next(e); }
});

router.put("/:id/payment", requireRole("admin"),
  body("amountPaid").isNumeric(),
  async (req, res, next) => {
    try {
      const { amountPaid, paymentMethod = "Cash" } = req.body;
      const { rows } = await query(
        `UPDATE members SET 
           sub_amount_paid = sub_amount_paid + $1,
           sub_is_paid = (sub_amount_paid + $1) >= sub_price_per_month AND sub_price_per_month > 0,
           sub_paid_at = CASE WHEN (sub_amount_paid + $1) >= sub_price_per_month AND sub_price_per_month > 0 THEN NOW() ELSE sub_paid_at END,
           updated_at = NOW()
         WHERE member_id = $2 RETURNING *`,
        [amountPaid, req.params.id]
      );
      if (!rows[0]) return res.status(404).json({ error: "Not found" });

      await query(
        `INSERT INTO payments (member_id, amount, method, type) VALUES ($1,$2,$3,'top-up')`,
        [req.params.id, amountPaid, paymentMethod]
      );
      
      await delCache([`messmate:member:${req.params.id}`, `messmate:member:${req.params.id}:subscription`]);
      await delByPattern("member:list");
      
      res.json(rowToMember(rows[0]).subscription);
    } catch (e) { next(e); }
  });

router.put("/:id/plan", requireRole("admin"), async (req, res, next) => {
  try {
    const { planId, meals, startDate } = req.body;
    const plan = (await query(`SELECT * FROM plans WHERE plan_id = $1`, [planId])).rows[0];
    const current = (await query(`SELECT * FROM members WHERE member_id = $1`, [req.params.id])).rows[0];
    if (!current) return res.status(404).json({ error: "Not found" });

    const newMeals = meals ?? plan?.meals ?? current.sub_meals;
    const newStart = startDate ? new Date(startDate) : current.sub_start_date;
    const newEnd = startDate ? addDays(new Date(startDate), 30) : current.sub_end_date;
    const newPrice = plan?.price_per_month ?? current.sub_price_per_month;
    const newPaid = current.sub_amount_paid >= newPrice && newPrice > 0;

    const { rows } = await query(
      `UPDATE members SET sub_plan_id = $1, sub_plan_label = $2, sub_meals = $3,
         sub_price_per_month = $4, sub_start_date = $5, sub_end_date = $6,
         sub_is_paid = $7, updated_at = NOW()
       WHERE member_id = $8 RETURNING *`,
      [planId, plan?.label ?? "Custom", newMeals,
       newPrice,
       newStart instanceof Date ? fmtDate(newStart) : newStart,
       newEnd instanceof Date ? fmtDate(newEnd) : newEnd,
       newPaid, req.params.id]
    );
    
    await delCache([`messmate:member:${req.params.id}`, `messmate:member:${req.params.id}:subscription`]);
    await delByPattern("member:list");
    await delByPattern("report:expiring");
    
    res.json(rowToMember(rows[0]).subscription);
  } catch (e) { next(e); }
});

export default router;
