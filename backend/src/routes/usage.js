import { Router } from "express";
import { format } from "date-fns";
import { verifyToken, requireRole } from "../middleware/authMiddleware.js";
import { MealUsage } from "../models/MealUsage.js";

const router = Router();
router.use(verifyToken);

router.get("/today", requireRole("admin"), async (_req, res, next) => {
  try {
    const date = format(new Date(), "yyyy-MM-dd");
    const items = await MealUsage.find({ date }).lean();
    res.json(items);
  } catch (e) { next(e); }
});

router.get("/summary/today", requireRole("admin", "staff"), async (_req, res, next) => {
  try {
    const date = format(new Date(), "yyyy-MM-dd");
    const items = await MealUsage.find({ date }).lean();
    const acc = { Breakfast: 0, Lunch: 0, Dinner: 0, total: 0 };
    items.forEach((u) => {
      if (u.usedMeals.Breakfast) { acc.Breakfast++; acc.total++; }
      if (u.usedMeals.Lunch) { acc.Lunch++; acc.total++; }
      if (u.usedMeals.Dinner) { acc.Dinner++; acc.total++; }
    });
    res.json(acc);
  } catch (e) { next(e); }
});

router.get("/:memberId", async (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.user.sub !== req.params.memberId)
      return res.status(403).json({ error: "Forbidden" });
    const { from, to } = req.query;
    const q = { memberId: req.params.memberId };
    if (from || to) q.date = {};
    if (from) q.date.$gte = from;
    if (to) q.date.$lte = to;
    const items = await MealUsage.find(q).sort({ date: -1 }).lean();
    res.json(items);
  } catch (e) { next(e); }
});

export default router;
