import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { body, validationResult } from "express-validator";
import { query, rowToMember, stripPassword } from "../db/index.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = Router();

const signAccess = (m) => jwt.sign(
  { sub: m.memberId, role: m.role, name: m.name },
  process.env.JWT_ACCESS_SECRET,
  { expiresIn: process.env.ACCESS_TOKEN_TTL || "15m" }
);
const signRefresh = (m) => jwt.sign(
  { sub: m.memberId },
  process.env.JWT_REFRESH_SECRET,
  { expiresIn: process.env.REFRESH_TOKEN_TTL || "7d" }
);

async function findMember(memberId, { activeOnly = true } = {}) {
  const { rows } = await query(
    `SELECT * FROM members WHERE member_id = $1 ${activeOnly ? "AND is_active = TRUE" : ""}`,
    [memberId]
  );
  return rowToMember(rows[0]);
}

router.post("/login",
  authLimiter,
  body("memberId").isString().trim().notEmpty(),
  body("password").isString().notEmpty(),
  async (req, res, next) => {
    try {
      const errs = validationResult(req);
      if (!errs.isEmpty()) return res.status(400).json({ error: "Invalid input", details: errs.array() });
      const { memberId, password } = req.body;
      const m = await findMember(memberId.toUpperCase());
      if (!m || !(await bcrypt.compare(password, m.passwordHash)))
        return res.status(401).json({ error: "Invalid credentials" });

      res.cookie("rt", signRefresh(m), {
        httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      res.json({ accessToken: signAccess(m), user: { id: m.memberId, name: m.name, role: m.role } });
    } catch (e) { next(e); }
  });

router.post("/refresh", async (req, res) => {
  const rt = req.cookies?.rt;
  if (!rt) return res.status(401).json({ error: "No refresh token" });
  try {
    const payload = jwt.verify(rt, process.env.JWT_REFRESH_SECRET);
    const m = await findMember(payload.sub);
    if (!m) return res.status(401).json({ error: "Invalid refresh" });
    res.json({ accessToken: signAccess(m) });
  } catch { res.status(401).json({ error: "Invalid refresh" }); }
});

router.post("/logout", (_req, res) => { res.clearCookie("rt"); res.json({ ok: true }); });

router.get("/me", verifyToken, async (req, res) => {
  const m = await findMember(req.user.sub, { activeOnly: false });
  if (!m) return res.status(404).json({ error: "Not found" });
  res.json(stripPassword(m));
});

export default router;
