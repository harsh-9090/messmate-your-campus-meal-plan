import { Router } from "express";
import { verifyToken, requireRole } from "../middleware/authMiddleware.js";
import { query } from "../db/index.js";
import { getCache, setCache, delCache } from "../db/redis.js";
import { body, param, validationResult } from "express-validator";

const router = Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: "Validation failed", details: errors.array() });
  }
  next();
};

const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;

const planCreateSchema = [
  body("planId")
    .trim()
    .notEmpty()
    .withMessage("planId is required")
    .isAlphanumeric("en-US", { ignore: "-_" })
    .withMessage("planId must be alphanumeric containing hyphens or underscores"),
  body("label")
    .trim()
    .notEmpty()
    .withMessage("label is required"),
  body("meals")
    .isArray({ min: 1 })
    .withMessage("meals must be an array containing at least one item")
    .custom((value) => {
      const allowed = ["Breakfast", "Lunch", "Dinner"];
      if (!value.every((meal) => allowed.includes(meal))) {
        throw new Error("Meals can only contain: Breakfast, Lunch, Dinner");
      }
      return true;
    }),
  body("pricePerMonth")
    .isInt({ min: 0 })
    .withMessage("pricePerMonth must be a non-negative integer"),
  body("durationMonths")
    .optional()
    .isInt({ min: 1 })
    .withMessage("durationMonths must be an integer >= 1"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
  validate
];

const planUpdateSchema = [
  param("planId")
    .trim()
    .notEmpty()
    .isAlphanumeric("en-US", { ignore: "-_" })
    .withMessage("planId must be alphanumeric containing hyphens or underscores"),
  body("label")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("label cannot be empty"),
  body("meals")
    .optional()
    .isArray({ min: 1 })
    .withMessage("meals must be an array containing at least one item")
    .custom((value) => {
      const allowed = ["Breakfast", "Lunch", "Dinner"];
      if (!value.every((meal) => allowed.includes(meal))) {
        throw new Error("Meals can only contain: Breakfast, Lunch, Dinner");
      }
      return true;
    }),
  body("pricePerMonth")
    .optional()
    .isInt({ min: 0 })
    .withMessage("pricePerMonth must be a non-negative integer"),
  body("durationMonths")
    .optional()
    .isInt({ min: 1 })
    .withMessage("durationMonths must be an integer >= 1"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
  validate
];

const windowUpdateSchema = [
  param("meal")
    .isIn(["Breakfast", "Lunch", "Dinner"])
    .withMessage("meal must be Breakfast, Lunch, or Dinner"),
  body("startTime")
    .trim()
    .notEmpty()
    .withMessage("startTime is required")
    .matches(timeRegex)
    .withMessage("startTime must match 24h format (HH:MM or HH:MM:SS)"),
  body("endTime")
    .trim()
    .notEmpty()
    .withMessage("endTime is required")
    .matches(timeRegex)
    .withMessage("endTime must match 24h format (HH:MM or HH:MM:SS)"),
  validate
];

// --- Plans (Public) ---
router.get("/plans", async (_req, res, next) => {
  try {
    const cached = await getCache("messmate:plan:list");
    if (cached) return res.json(cached);

    const { rows } = await query(`SELECT * FROM plans WHERE is_active = TRUE ORDER BY price_per_month DESC`);
    const result = rows.map((p) => ({
      planId: p.plan_id, label: p.label, meals: p.meals, pricePerMonth: p.price_per_month, durationMonths: p.duration_months, isActive: p.is_active,
    }));
    await setCache("messmate:plan:list", result, 1800); // 30 min
    res.json(result);
  } catch (e) { next(e); }
});

// --- Meal windows (Public) ---
router.get("/windows", async (_req, res, next) => {
  try {
    const cached = await getCache("messmate:window:list");
    if (cached) return res.json(cached);

    const { rows } = await query(`SELECT * FROM meal_windows WHERE is_active = TRUE ORDER BY start_time ASC`);
    const result = rows.map((w) => ({ meal: w.meal, startTime: w.start_time, endTime: w.end_time, isActive: w.is_active }));
    await setCache("messmate:window:list", result, 1800); // 30 min
    res.json(result);
  } catch (e) { next(e); }
});

// All following routes require authentication
router.use(verifyToken);

// --- Admin Plan Actions ---

router.post("/plans", requireRole("admin"), planCreateSchema, async (req, res, next) => {
  try {
    const { planId, label, meals, pricePerMonth, durationMonths = 1, isActive = true } = req.body;
    const { rows } = await query(
      `INSERT INTO plans (plan_id, label, meals, price_per_month, duration_months, is_active)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [planId, label, meals, pricePerMonth, durationMonths, isActive]
    );
    
    await delCache(["messmate:plan:list", `messmate:plan:${planId}`]);
    
    const p = rows[0];
    res.status(201).json({ planId: p.plan_id, label: p.label, meals: p.meals, pricePerMonth: p.price_per_month, durationMonths: p.duration_months, isActive: p.is_active });
  } catch (e) { next(e); }
});

router.put("/plans/:planId", requireRole("admin"), planUpdateSchema, async (req, res, next) => {
  try {
    const allowed = { label: "label", meals: "meals", pricePerMonth: "price_per_month", durationMonths: "duration_months", isActive: "is_active" };
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
    
    await delCache(["messmate:plan:list", `messmate:plan:${req.params.planId}`]);
    
    const p = rows[0];
    res.json({ planId: p.plan_id, label: p.label, meals: p.meals, pricePerMonth: p.price_per_month, durationMonths: p.duration_months, isActive: p.is_active });
  } catch (e) { next(e); }
});

router.delete("/plans/:planId", requireRole("admin"), async (req, res, next) => {
  try {
    const { planId } = req.params;
    await query(`DELETE FROM plans WHERE plan_id = $1`, [planId]);
    await delCache(["messmate:plan:list", `messmate:plan:${planId}`]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// --- Meal windows ---
router.get("/windows", async (_req, res, next) => {
  try {
    const cached = await getCache("messmate:window:list");
    if (cached) return res.json(cached);

    const { rows } = await query(`SELECT * FROM meal_windows ORDER BY start_time ASC`);
    const result = rows.map((w) => ({ meal: w.meal, startTime: w.start_time, endTime: w.end_time, isActive: w.is_active }));
    await setCache("messmate:window:list", result, 1800); // 30 min
    res.json(result);
  } catch (e) { next(e); }
});

router.put("/windows/:meal", requireRole("admin"), windowUpdateSchema, async (req, res, next) => {
  try {
    const { startTime, endTime } = req.body;
    const { rows } = await query(
      `INSERT INTO meal_windows (meal, start_time, end_time)
       VALUES ($1,$2,$3)
       ON CONFLICT (meal) DO UPDATE SET start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time, updated_at = NOW()
       RETURNING *`,
      [req.params.meal, startTime, endTime]
    );
    
    await delCache(["messmate:window:list", `messmate:window:${req.params.meal}`]);
    
    const w = rows[0];
    res.json({ meal: w.meal, startTime: w.start_time, endTime: w.end_time, isActive: w.is_active });
  } catch (e) { next(e); }
});

export default router;
