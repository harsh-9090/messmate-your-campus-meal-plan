import { Router } from "express";
import { verifyToken, requireRole } from "../middleware/authMiddleware.js";
import { Plan } from "../models/Plan.js";
import { MealWindow } from "../models/MealWindow.js";

const router = Router();
router.use(verifyToken);

router.get("/plans", async (_req, res, next) => {
  try { res.json(await Plan.find({ isActive: true }).lean()); } catch (e) { next(e); }
});
router.post("/plans", requireRole("admin"), async (req, res, next) => {
  try { res.status(201).json(await Plan.create(req.body)); } catch (e) { next(e); }
});
router.put("/plans/:planId", requireRole("admin"), async (req, res, next) => {
  try { res.json(await Plan.findOneAndUpdate({ planId: req.params.planId }, req.body, { new: true })); } catch (e) { next(e); }
});

router.get("/windows", async (_req, res, next) => {
  try { res.json(await MealWindow.find().lean()); } catch (e) { next(e); }
});
router.put("/windows/:meal", requireRole("admin"), async (req, res, next) => {
  try {
    const w = await MealWindow.findOneAndUpdate(
      { meal: req.params.meal },
      { $set: { startTime: req.body.startTime, endTime: req.body.endTime } },
      { new: true, upsert: true }
    );
    res.json(w);
  } catch (e) { next(e); }
});

export default router;
