import { Router } from "express";
import { verifyToken, requireRole } from "../middleware/authMiddleware.js";
import { query } from "../db/index.js";

const router = Router();
router.use(verifyToken);

// --- Plans ---
router.get("/plans", async (_req, res, next) => {
  try {
    const { rows } = await query(`SELECT * FROM plans WHERE is_active = TRUE ORDER BY price_per_month DESC`);
    res.json(rows.map((p) => ({
      planId: p.plan_id, label: p.label, meals: p.meals, pricePerMonth: p.price_per_month, isActive: p.is_active,
    })));
  } catch (e) { next(e); }
});

router.post("/plans", requireRole("admin"), async (req, res, next) => {
  try {
    const { planId, label, meals, pricePerMonth, isActive = true } = req.body;
    const { rows } = await query(
      `INSERT INTO plans (plan_id, label, meals, price_per_month, is_active)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [planId, label, meals, pricePerMonth, isActive]
    );
    const p = rows[0];
    res.status(201).json({ planId: p.plan_id, label: p.label, meals: p.meals, pricePerMonth: p.price_per_month, isActive: p.is_active });
  } catch (e) { next(e); }
});

router.put("/plans/:planId", requireRole("admin"), async (req, res, next) => {
  try {
    const allowed = { label: "label", meals: "meals", pricePerMonth: "price_per_month", isActive: "is_active" };
    const sets = []; const params = [];
    for (const [k, col] of Object.entries(allowed)) {
      if (k in req.body) { params.push(req.body[k]); sets.push(`${col} = $${params.length}`); }
    }
    if (!sets.length) return res.status(400).json({ error: "No updatable fields" });
    sets.push(`updated_at = NOW()`);
    params.push(req.params.planId);
    const { rows } = await query(
      `UPDATE plans SET ${sets.join(", ")} WHERE plan_id = $${params.length} RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    const p = rows[0];
    res.json({ planId: p.plan_id, label: p.label, meals: p.meals, pricePerMonth: p.price_per_month, isActive: p.is_active });
  } catch (e) { next(e); }
});

// --- Meal windows ---
router.get("/windows", async (_req, res, next) => {
  try {
    const { rows } = await query(`SELECT * FROM meal_windows ORDER BY start_time ASC`);
    res.json(rows.map((w) => ({ meal: w.meal, startTime: w.start_time, endTime: w.end_time, isActive: w.is_active })));
  } catch (e) { next(e); }
});

router.put("/windows/:meal", requireRole("admin"), async (req, res, next) => {
  try {
    const { startTime, endTime } = req.body;
    const { rows } = await query(
      `INSERT INTO meal_windows (meal, start_time, end_time)
       VALUES ($1,$2,$3)
       ON CONFLICT (meal) DO UPDATE SET start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time, updated_at = NOW()
       RETURNING *`,
      [req.params.meal, startTime, endTime]
    );
    const w = rows[0];
    res.json({ meal: w.meal, startTime: w.start_time, endTime: w.end_time, isActive: w.is_active });
  } catch (e) { next(e); }
});

export default router;
