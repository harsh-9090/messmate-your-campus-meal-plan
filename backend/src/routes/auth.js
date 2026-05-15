import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { body, validationResult } from "express-validator";
import { Member } from "../models/Member.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = Router();

const signAccess = (m) => jwt.sign({ sub: m.memberId, role: m.role, name: m.name },
  process.env.JWT_ACCESS_SECRET, { expiresIn: process.env.ACCESS_TOKEN_TTL || "15m" });
const signRefresh = (m) => jwt.sign({ sub: m.memberId },
  process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.REFRESH_TOKEN_TTL || "7d" });

router.post("/login",
  authLimiter,
  body("memberId").isString().trim().notEmpty(),
  body("password").isString().notEmpty(),
  async (req, res, next) => {
    try {
      const errs = validationResult(req);
      if (!errs.isEmpty()) return res.status(400).json({ error: "Invalid input", details: errs.array() });
      const { memberId, password } = req.body;
      const m = await Member.findOne({ memberId: memberId.toUpperCase(), isActive: true });
      if (!m || !(await bcrypt.compare(password, m.passwordHash)))
        return res.status(401).json({ error: "Invalid credentials" });

      const accessToken = signAccess(m);
      const refreshToken = signRefresh(m);
      res.cookie("rt", refreshToken, {
        httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      res.json({ accessToken, user: { id: m.memberId, name: m.name, role: m.role } });
    } catch (e) { next(e); }
  });

router.post("/refresh", async (req, res) => {
  const rt = req.cookies?.rt;
  if (!rt) return res.status(401).json({ error: "No refresh token" });
  try {
    const payload = jwt.verify(rt, process.env.JWT_REFRESH_SECRET);
    const m = await Member.findOne({ memberId: payload.sub, isActive: true });
    if (!m) return res.status(401).json({ error: "Invalid refresh" });
    res.json({ accessToken: signAccess(m) });
  } catch { res.status(401).json({ error: "Invalid refresh" }); }
});

router.post("/logout", (_req, res) => { res.clearCookie("rt"); res.json({ ok: true }); });

router.get("/me", verifyToken, async (req, res) => {
  const m = await Member.findOne({ memberId: req.user.sub }).lean();
  if (!m) return res.status(404).json({ error: "Not found" });
  delete m.passwordHash;
  res.json(m);
});

export default router;
