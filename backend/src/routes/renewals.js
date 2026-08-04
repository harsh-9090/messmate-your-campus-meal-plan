import { Router } from "express";
import { body, validationResult } from "express-validator";
import { query, withTx } from "../db/index.js";
import { requireRole, verifyToken } from "../middleware/authMiddleware.js";
import { queueEmailJob, queuePushJob } from "../queues/notificationQueue.js";
import { delCache, delByPattern } from "../db/redis.js";
import { format, addDays } from "date-fns";

const fmtDate = (d) => format(d, "yyyy-MM-dd");

const router = Router();

// ==========================================
// MEMBER ROUTES
// ==========================================

// GET /api/v1/renewals/my - Fetch member's pending request
router.get("/my", verifyToken, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT r.*, p.label as plan_label, p.price_per_month 
       FROM renewal_requests r
       JOIN plans p ON r.plan_id = p.plan_id
       WHERE r.member_id = $1 AND r.status = 'pending'
       ORDER BY r.created_at DESC LIMIT 1`,
      [req.user.sub]
    );
    res.json(rows[0] || null);
  } catch (e) {
    next(e);
  }
});

// POST /api/v1/renewals/my - Create a new request
router.post("/my",
  verifyToken,
  body("planId").isString().trim().notEmpty(),
  body("startDate").isString().trim().notEmpty(),
  async (req, res, next) => {
    try {
      const errs = validationResult(req);
      if (!errs.isEmpty()) return res.status(400).json({ error: "Invalid input" });

      const { planId, startDate } = req.body;
      const memberId = req.user.sub;

      // 1. Check if they already have a pending request
      const existing = await query(
        `SELECT id FROM renewal_requests WHERE member_id = $1 AND status = 'pending'`,
        [memberId]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: "You already have a pending renewal request." });
      }

      // 2. Validate plan
      const { rows: planRows } = await query("SELECT * FROM plans WHERE plan_id = $1", [planId]);
      if (planRows.length === 0) return res.status(400).json({ error: "Invalid plan selected" });
      const planLabel = planRows[0].label;

      // 3. Insert request
      const { rows } = await query(
        `INSERT INTO renewal_requests (member_id, plan_id, start_date) 
         VALUES ($1, $2, $3) RETURNING *`,
        [memberId, planId, fmtDate(new Date(startDate))]
      );

      // 4. Notify Admins via Push
      queuePushJob("admins", {
        payload: {
          title: "Renewal Request 🔄",
          body: `${req.user.name || memberId} requested to renew their plan (${planLabel}).`,
          url: `/admin/renewals`,
        }
      });

      res.status(201).json(rows[0]);
    } catch (e) {
      next(e);
    }
  }
);

// ==========================================
// ADMIN ROUTES
// ==========================================

// GET /api/v1/renewals - List all pending requests
router.get("/", verifyToken, requireRole("admin"), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT r.id, r.member_id, r.plan_id, r.start_date, r.status, r.created_at,
              m.name as member_name, m.email as member_email, m.mobile as member_mobile,
              (m.sub_price_per_month - m.sub_amount_paid) as current_due,
              p.label as plan_label, p.price_per_month as plan_price, p.meals as plan_meals
       FROM renewal_requests r
       JOIN members m ON r.member_id = m.member_id
       JOIN plans p ON r.plan_id = p.plan_id
       WHERE r.status = 'pending'
       ORDER BY r.created_at ASC`
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// POST /api/v1/renewals/:id/approve - Approve request
router.post("/:id/approve",
  verifyToken,
  requireRole("admin"),
  body("amountPaid").isNumeric(),
  async (req, res, next) => {
    try {
      const { amountPaid } = req.body;
      const { id } = req.params;

      const { rows: reqRows } = await query(
        `SELECT r.*, m.name, m.email, m.mobile, m.sub_amount_paid, m.sub_price_per_month, p.label, p.meals, p.price_per_month, p.duration_months
         FROM renewal_requests r
         JOIN members m ON r.member_id = m.member_id
         JOIN plans p ON r.plan_id = p.plan_id
         WHERE r.id = $1 AND r.status = 'pending'`,
        [id]
      );

      if (reqRows.length === 0) return res.status(404).json({ error: "Pending request not found" });
      const request = reqRows[0];
      const memberId = request.member_id;

      const cycleStart = new Date(request.start_date);
      const end = addDays(cycleStart, (request.duration_months || 1) * 30 - 1);
      const isPaid = amountPaid >= request.price_per_month && request.price_per_month > 0;

      await withTx(async (client) => {
        // 1. Mark request as approved
        await client.query(
          `UPDATE renewal_requests SET status = 'approved', resolved_at = NOW() WHERE id = $1`,
          [id]
        );

        // 2. Expire old active/pending subscriptions
        await client.query(
          `UPDATE subscriptions 
           SET status = 'expired', updated_at = NOW() 
           WHERE member_id = $1 AND status IN ('active', 'pending')`,
          [memberId]
        );

        // 3. Insert new active subscription record
        await client.query(
          `INSERT INTO subscriptions (
            member_id, plan_id, plan_label, meals, start_date, end_date,
            price_per_month, amount_paid, is_paid, paid_at, status, renewed_at
          )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CASE WHEN $9 THEN NOW() ELSE NULL END, 'active', NOW())`,
          [memberId, request.plan_id, request.label, request.meals || "{}", fmtDate(cycleStart), fmtDate(end), request.price_per_month, amountPaid, isPaid]
        );

        // 4. Update the member profile
        await client.query(
          `UPDATE members SET 
             sub_plan_id = $1, sub_plan_label = $2, sub_meals = $3,
             sub_start_date = $4, sub_end_date = $5, 
             sub_is_paid = $6, sub_price_per_month = $7, sub_amount_paid = $8,
             sub_renewed_at = NOW(), sub_renewal_count = sub_renewal_count + 1,
             sub_paid_at = CASE WHEN $6 THEN NOW() ELSE sub_paid_at END, 
             is_active = TRUE,
             updated_at = NOW()
           WHERE member_id = $9`,
          [request.plan_id, request.label, request.meals || "{}", fmtDate(cycleStart), fmtDate(end), isPaid, request.price_per_month, amountPaid, memberId]
        );

        // 5. Insert payment if > 0
        if (amountPaid > 0) {
          await client.query(
            `INSERT INTO payments (member_id, member_name, member_mobile, amount, method, type, plan_id) VALUES ($1,$2,$3,$4,$5,'renewal',$6)`,
            [memberId, request.name, request.mobile, amountPaid, 'Cash', request.plan_id]
          );
        }
      });

      await delCache([`messmate:member:${memberId}`, `messmate:member:${memberId}:subscription`, `messmate:report:weekly`]);
      await delByPattern("member:list");
      await delByPattern("report:expiring");

      queueEmailJob("activation", {
        member: { memberId, name: request.name, email: request.email },
        planDetails: {
          label: request.label,
          meals: request.meals,
          startDate: fmtDate(cycleStart),
          endDate: fmtDate(end),
          price: request.price_per_month,
          amountPaid: amountPaid,
          dueAmount: Math.max(0, request.price_per_month - amountPaid)
        }
      });

      res.json({ ok: true, message: "Request approved and plan renewed." });
    } catch (e) {
      next(e);
    }
  }
);

// POST /api/v1/renewals/:id/reject - Reject request
router.post("/:id/reject", verifyToken, requireRole("admin"), async (req, res, next) => {
  try {
    const { id } = req.params;

    const { rows } = await query(
      `UPDATE renewal_requests SET status = 'rejected', resolved_at = NOW() 
       WHERE id = $1 AND status = 'pending' RETURNING *`,
      [id]
    );

    if (rows.length === 0) return res.status(404).json({ error: "Pending request not found" });
    const reqData = rows[0];

    // fetch member email
    const member = await query(`SELECT name, email FROM members WHERE member_id = $1`, [reqData.member_id]);
    if (member.rows.length > 0) {
      queueEmailJob("plain", {
        to: member.rows[0].email,
        subject: "Renewal Request Update",
        text: `Hi ${member.rows[0].name},\n\nYour renewal request has been rejected by the admin. Please contact the mess office for more details.\n\nThanks,\nMom's Kitchen`
      });
    }

    res.json({ ok: true, message: "Request rejected." });
  } catch (e) {
    next(e);
  }
});

export default router;
