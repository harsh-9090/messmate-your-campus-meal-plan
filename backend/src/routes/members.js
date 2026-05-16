import { Router } from "express";
import bcrypt from "bcrypt";
import { addDays, format } from "date-fns";
import { body, validationResult } from "express-validator";
import { query, rowToMember, stripPassword } from "../db/index.js";
import { verifyToken, requireRole } from "../middleware/authMiddleware.js";
import { nextMemberId } from "../services/memberIdService.js";

const router = Router();
router.use(verifyToken);

const fmtDate = (d) => format(d, "yyyy-MM-dd");

// list (admin)
router.get("/", requireRole("admin"), async (req, res, next) => {
  try {
    const { search = "", status, page = 1, limit = 20 } = req.query;
    const where = [`is_active = TRUE`, `role = 'member'`];
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      where.push(`(name ILIKE $${params.length} OR member_id ILIKE $${params.length} OR room ILIKE $${params.length})`);
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
    res.json({
      items: items.rows.map((r) => stripPassword(rowToMember(r))),
      total: total.rows[0].c, page: pg, limit: lim,
    });
  } catch (e) { next(e); }
});

router.get("/:id", async (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.user.sub !== req.params.id)
      return res.status(403).json({ error: "Forbidden" });
    const { rows } = await query(`SELECT * FROM members WHERE member_id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    res.json(stripPassword(rowToMember(rows[0])));
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
      const { name, email, password, room = null, planId, meals, startDate, isPaid = false, role = "member" } = req.body;

      const plan = (await query(`SELECT * FROM plans WHERE plan_id = $1`, [planId])).rows[0];
      const start = new Date(startDate);
      const end = addDays(start, 30);
      const id = await nextMemberId();
      const hash = await bcrypt.hash(password, 12);

      const { rows } = await query(
        `INSERT INTO members
         (member_id, name, email, password_hash, room, role, is_active,
          sub_plan_id, sub_plan_label, sub_meals, sub_start_date, sub_end_date,
          sub_is_paid, sub_paid_at, sub_price_per_month, sub_renewal_count)
         VALUES ($1,$2,$3,$4,$5,$6,TRUE,$7,$8,$9,$10,$11,$12,$13,$14,0)
         RETURNING *`,
        [id, name, email, hash, room, role,
          planId, plan?.label ?? "Custom", meals, fmtDate(start), fmtDate(end),
          isPaid, isPaid ? new Date() : null, plan?.price_per_month ?? 0]
      );
      res.status(201).json(stripPassword(rowToMember(rows[0])));
    } catch (e) { next(e); }
  });

router.put("/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const allowed = { name: "name", email: "email", room: "room", role: "role", photoUrl: "photo_url" };
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
    res.json(stripPassword(rowToMember(rows[0])));
  } catch (e) { next(e); }
});

router.delete("/:id", requireRole("admin"), async (req, res, next) => {
  try {
    await query(`UPDATE members SET is_active = FALSE, updated_at = NOW() WHERE member_id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.put("/:id/renew", requireRole("admin"), async (req, res, next) => {
  try {
    const today = new Date();
    const end = addDays(today, 30);
    const { rows } = await query(
      `UPDATE members SET sub_start_date = $1, sub_end_date = $2, sub_is_paid = TRUE,
         sub_renewed_at = NOW(), sub_renewal_count = sub_renewal_count + 1,
         sub_paid_at = NOW(), updated_at = NOW()
       WHERE member_id = $3 RETURNING *`,
      [fmtDate(today), fmtDate(end), req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    res.json(rowToMember(rows[0]).subscription);
  } catch (e) { next(e); }
});

router.put("/:id/payment", requireRole("admin"),
  body("isPaid").isBoolean(),
  async (req, res, next) => {
    try {
      const { rows } = await query(
        `UPDATE members SET sub_is_paid = $1,
           sub_paid_at = CASE WHEN $1 THEN NOW() ELSE sub_paid_at END,
           updated_at = NOW()
         WHERE member_id = $2 RETURNING *`,
        [req.body.isPaid, req.params.id]
      );
      if (!rows[0]) return res.status(404).json({ error: "Not found" });
      res.json(rowToMember(rows[0]).subscription);
    } catch (e) { next(e); }
  });

router.put("/:id/plan", requireRole("admin"), async (req, res, next) => {
  try {
    const { planId, meals, startDate, isPaid } = req.body;
    const plan = (await query(`SELECT * FROM plans WHERE plan_id = $1`, [planId])).rows[0];
    const current = (await query(`SELECT * FROM members WHERE member_id = $1`, [req.params.id])).rows[0];
    if (!current) return res.status(404).json({ error: "Not found" });

    const newMeals = meals ?? plan?.meals ?? current.sub_meals;
    const newStart = startDate ? new Date(startDate) : current.sub_start_date;
    const newEnd = startDate ? addDays(new Date(startDate), 30) : current.sub_end_date;
    const newPaid = typeof isPaid === "boolean" ? isPaid : current.sub_is_paid;

    const { rows } = await query(
      `UPDATE members SET sub_plan_id = $1, sub_plan_label = $2, sub_meals = $3,
         sub_price_per_month = $4, sub_start_date = $5, sub_end_date = $6,
         sub_is_paid = $7, updated_at = NOW()
       WHERE member_id = $8 RETURNING *`,
      [planId, plan?.label ?? "Custom", newMeals,
       plan?.price_per_month ?? current.sub_price_per_month,
       newStart instanceof Date ? fmtDate(newStart) : newStart,
       newEnd instanceof Date ? fmtDate(newEnd) : newEnd,
       newPaid, req.params.id]
    );
    res.json(rowToMember(rows[0]).subscription);
  } catch (e) { next(e); }
});

export default router;
