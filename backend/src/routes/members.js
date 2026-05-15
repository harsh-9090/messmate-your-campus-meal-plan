import { Router } from "express";
import bcrypt from "bcrypt";
import { addDays } from "date-fns";
import { body, validationResult } from "express-validator";
import { Member } from "../models/Member.js";
import { Plan } from "../models/Plan.js";
import { verifyToken, requireRole } from "../middleware/authMiddleware.js";
import { nextMemberId } from "../services/memberIdService.js";

const router = Router();
router.use(verifyToken);

// list (admin)
router.get("/", requireRole("admin"), async (req, res, next) => {
  try {
    const { search = "", status, page = 1, limit = 20 } = req.query;
    const q = { isActive: true, role: "member" };
    if (search) q.$or = [
      { name: { $regex: search, $options: "i" } },
      { memberId: { $regex: search, $options: "i" } },
      { room: { $regex: search, $options: "i" } },
    ];
    const today = new Date();
    if (status === "expired") q["subscription.endDate"] = { $lt: today };
    if (status === "unpaid") q["subscription.isPaid"] = false;
    if (status === "active") { q["subscription.isPaid"] = true; q["subscription.endDate"] = { $gte: today }; }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [items, total] = await Promise.all([
      Member.find(q).select("-passwordHash").skip(skip).limit(parseInt(limit)).sort({ memberId: 1 }).lean(),
      Member.countDocuments(q),
    ]);
    res.json({ items, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) { next(e); }
});

router.get("/:id", async (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.user.sub !== req.params.id)
      return res.status(403).json({ error: "Forbidden" });
    const m = await Member.findOne({ memberId: req.params.id }).select("-passwordHash").lean();
    if (!m) return res.status(404).json({ error: "Not found" });
    res.json(m);
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
      const { name, email, password, room, planId, meals, startDate, isPaid = false, role = "member" } = req.body;

      const plan = await Plan.findOne({ planId });
      const start = new Date(startDate);
      const member = await Member.create({
        memberId: await nextMemberId(),
        name, email, room, role, isActive: true,
        passwordHash: await bcrypt.hash(password, 12),
        subscription: {
          planId,
          planLabel: plan?.label ?? "Custom",
          meals,
          startDate: start,
          endDate: addDays(start, 30),
          isPaid,
          paidAt: isPaid ? new Date() : undefined,
          pricePerMonth: plan?.pricePerMonth ?? 0,
          renewalCount: 0,
        },
      });
      const out = member.toObject(); delete out.passwordHash;
      res.status(201).json(out);
    } catch (e) { next(e); }
  });

router.put("/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const updates = { ...req.body };
    if (updates.password) { updates.passwordHash = await bcrypt.hash(updates.password, 12); delete updates.password; }
    const m = await Member.findOneAndUpdate({ memberId: req.params.id }, updates, { new: true })
      .select("-passwordHash").lean();
    if (!m) return res.status(404).json({ error: "Not found" });
    res.json(m);
  } catch (e) { next(e); }
});

router.delete("/:id", requireRole("admin"), async (req, res, next) => {
  try {
    await Member.updateOne({ memberId: req.params.id }, { isActive: false });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.put("/:id/renew", requireRole("admin"), async (req, res, next) => {
  try {
    const today = new Date();
    const m = await Member.findOne({ memberId: req.params.id });
    if (!m) return res.status(404).json({ error: "Not found" });
    m.subscription.startDate = today;
    m.subscription.endDate = addDays(today, 30);
    m.subscription.isPaid = true;
    m.subscription.renewedAt = today;
    m.subscription.renewalCount = (m.subscription.renewalCount || 0) + 1;
    await m.save();
    res.json(m.subscription);
  } catch (e) { next(e); }
});

router.put("/:id/payment", requireRole("admin"),
  body("isPaid").isBoolean(),
  async (req, res, next) => {
    try {
      const m = await Member.findOne({ memberId: req.params.id });
      if (!m) return res.status(404).json({ error: "Not found" });
      m.subscription.isPaid = req.body.isPaid;
      if (req.body.isPaid) m.subscription.paidAt = new Date();
      await m.save();
      res.json(m.subscription);
    } catch (e) { next(e); }
  });

router.put("/:id/plan", requireRole("admin"), async (req, res, next) => {
  try {
    const { planId, meals, startDate, isPaid } = req.body;
    const plan = await Plan.findOne({ planId });
    const m = await Member.findOne({ memberId: req.params.id });
    if (!m) return res.status(404).json({ error: "Not found" });
    m.subscription.planId = planId;
    m.subscription.planLabel = plan?.label ?? "Custom";
    m.subscription.meals = meals ?? plan?.meals ?? m.subscription.meals;
    if (plan) m.subscription.pricePerMonth = plan.pricePerMonth;
    if (startDate) {
      const s = new Date(startDate);
      m.subscription.startDate = s;
      m.subscription.endDate = addDays(s, 30);
    }
    if (typeof isPaid === "boolean") m.subscription.isPaid = isPaid;
    await m.save();
    res.json(m.subscription);
  } catch (e) { next(e); }
});

export default router;
