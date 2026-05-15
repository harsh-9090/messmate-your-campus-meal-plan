import { Router } from "express";
import { format, addDays } from "date-fns";
import { verifyToken, requireRole } from "../middleware/authMiddleware.js";
import { MealUsage } from "../models/MealUsage.js";
import { ScanLog } from "../models/ScanLog.js";
import { Member } from "../models/Member.js";
import { toCsv } from "../services/reportService.js";

const router = Router();
router.use(verifyToken, requireRole("admin"));

router.get("/daily", async (req, res, next) => {
  try {
    const date = req.query.date || format(new Date(), "yyyy-MM-dd");
    const [usage, logs] = await Promise.all([
      MealUsage.find({ date }).lean(),
      ScanLog.find({ date }).lean(),
    ]);
    const meals = { Breakfast: 0, Lunch: 0, Dinner: 0 };
    usage.forEach((u) => { if (u.usedMeals.Breakfast) meals.Breakfast++; if (u.usedMeals.Lunch) meals.Lunch++; if (u.usedMeals.Dinner) meals.Dinner++; });
    const allowed = logs.filter((l) => l.status === "allowed").length;
    const denied = logs.filter((l) => l.status === "denied").length;
    const denialBreakdown = {};
    logs.filter((l) => l.status === "denied").forEach((l) => { denialBreakdown[l.denialCode] = (denialBreakdown[l.denialCode] || 0) + 1; });
    res.json({ date, meals, allowed, denied, total: allowed + denied, denialBreakdown });
  } catch (e) { next(e); }
});

router.get("/weekly", async (_req, res, next) => {
  try {
    const days = Array.from({ length: 7 }, (_, i) => format(addDays(new Date(), -6 + i), "yyyy-MM-dd"));
    const usage = await MealUsage.find({ date: { $in: days } }).lean();
    const byDate = days.map((d) => {
      const dayU = usage.filter((u) => u.date === d);
      const meals = dayU.reduce((s, u) => s + (u.usedMeals.Breakfast ? 1 : 0) + (u.usedMeals.Lunch ? 1 : 0) + (u.usedMeals.Dinner ? 1 : 0), 0);
      return { date: d, meals };
    });
    const members = await Member.find({ role: "member", isActive: true, "subscription.isPaid": true, "subscription.endDate": { $gte: new Date() } }).lean();
    const revenue = members.reduce((s, m) => s + (m.subscription.pricePerMonth || 0), 0);
    res.json({ days: byDate, estimatedMonthlyRevenue: revenue });
  } catch (e) { next(e); }
});

router.get("/monthly", async (req, res, next) => {
  try {
    const month = req.query.month || format(new Date(), "yyyy-MM");
    const usage = await MealUsage.find({ date: { $regex: `^${month}` } }).lean();
    const total = usage.reduce((s, u) => s + (u.usedCount || 0), 0);
    res.json({ month, totalMeals: total, days: usage.length });
  } catch (e) { next(e); }
});

router.get("/expiring", async (req, res, next) => {
  try {
    const days = parseInt(req.query.days || "7", 10);
    const cutoff = addDays(new Date(), days);
    const items = await Member.find({
      role: "member", isActive: true,
      "subscription.endDate": { $gte: new Date(), $lte: cutoff },
    }).select("-passwordHash").lean();
    res.json(items);
  } catch (e) { next(e); }
});

router.get("/denials", async (req, res, next) => {
  try {
    const date = req.query.date || format(new Date(), "yyyy-MM-dd");
    const logs = await ScanLog.find({ date, status: "denied" }).lean();
    const grouped = {};
    logs.forEach((l) => { grouped[l.denialCode] = (grouped[l.denialCode] || 0) + 1; });
    res.json({ date, total: logs.length, breakdown: grouped });
  } catch (e) { next(e); }
});

router.get("/export", async (req, res, next) => {
  try {
    const { type = "daily", format: fmt = "csv" } = req.query;
    let rows = [];
    if (type === "daily") {
      const date = req.query.date || format(new Date(), "yyyy-MM-dd");
      const logs = await ScanLog.find({ date }).lean();
      rows = logs.map((l) => ({
        date: l.date, time: l.timestamp, memberId: l.memberId, memberName: l.memberName,
        meal: l.meal, status: l.status, code: l.denialCode || "", reason: l.denialReason || "",
      }));
    }
    if (fmt === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="messmate-${type}.csv"`);
      return res.send(toCsv(rows));
    }
    res.json(rows);
  } catch (e) { next(e); }
});

export default router;
