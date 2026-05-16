import { Router } from "express";
import { verifyToken, requireRole } from "../middleware/authMiddleware.js";
import { query } from "../db/index.js";

const router = Router();
router.use(verifyToken);
router.use(requireRole("admin"));

// List all payments with member details
router.get("/", async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    const { rows } = await query(`
      SELECT 
        p.*, 
        COALESCE(m.name, p.member_name) as member_name,
        COALESCE(m.mobile, p.member_mobile) as member_mobile,
        m.sub_plan_label,
        pl.label as plan_label
      FROM payments p
      LEFT JOIN members m ON p.member_id = m.member_id
      LEFT JOIN plans pl ON p.plan_id = pl.plan_id
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    res.json(rows.map(r => ({
      id: r.id,
      memberId: r.member_id || 'DELETED',
      memberName: r.member_name,
      memberMobile: r.member_mobile,
      planId: r.plan_id,
      planLabel: r.plan_label || r.sub_plan_label || 'Custom',
      amount: r.amount,
      method: r.method,
      type: r.type,
      createdAt: r.created_at
    })));
  } catch (e) { next(e); }
});

// Delete a payment record
router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    await query(`DELETE FROM payments WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
