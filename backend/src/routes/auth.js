import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { body, validationResult } from "express-validator";
import { query, rowToMember, stripPassword } from "../db/index.js";
import { nextMemberId } from "../services/memberIdService.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { delByPattern, blacklistToken, isTokenBlacklisted, getCache, setCache, delCache } from "../db/redis.js";
import { addDays, format } from "date-fns";
import crypto from "node:crypto";
import { sendPasswordResetEmail, sendRegistrationReceivedEmail, sendVerificationOTPEmail } from "../services/notificationService.js";
import { sendPushToAdminsAndStaff } from "../services/pushNotificationService.js";

const fmtDate = (d) => format(d, "yyyy-MM-dd");

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

async function findUser(identifier, { activeOnly = true } = {}) {
  // Try matching member_id (uppercase), email, or mobile
  const { rows } = await query(
    `SELECT * FROM members 
     WHERE (member_id = $1 OR email = $1 OR mobile = $1) 
     ${activeOnly ? "AND is_active = TRUE" : ""}`,
    [identifier]
  );
  return rows[0] ? rowToMember(rows[0]) : null;
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
      
      // Try exact, then uppercase for member_id
      let m = await findUser(memberId);
      if (!m) m = await findUser(memberId.toUpperCase());
      
      if (!m || !(await bcrypt.compare(password, m.passwordHash)))
        return res.status(401).json({ error: "Invalid credentials" });

      res.cookie("rt", signRefresh(m), {
        httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      res.json({ accessToken: signAccess(m), user: { id: m.memberId, name: m.name, role: m.role, emailVerified: m.emailVerified } });
    } catch (e) { next(e); }
  });

router.post("/register",
  body("name").isString().trim().notEmpty(),
  body("email").isEmail().normalizeEmail(),
  body("mobile").isString().trim().notEmpty(),
  body("password")
    .isString()
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
    .withMessage("Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"),
  async (req, res, next) => {
    try {
      const errs = validationResult(req);
      if (!errs.isEmpty()) return res.status(400).json({ error: "Invalid input", details: errs.array() });
      
      const { name, email, mobile, password, planId } = req.body;
      
      const mid = await nextMemberId();
      
      const existing = await findUser(mid, { activeOnly: false });
      if (existing) return res.status(409).json({ error: "System busy, please try again" });
      
      const emailCheck = await findUser(email, { activeOnly: false });
      if (emailCheck) return res.status(409).json({ error: "Email already registered" });

      const mobileCheck = await findUser(mobile, { activeOnly: false });
      if (mobileCheck) return res.status(409).json({ error: "Mobile number already registered" });

      const { rows: planRows } = await query("SELECT * FROM plans WHERE plan_id = $1", [planId]);
      if (planRows.length === 0) return res.status(400).json({ error: "Invalid plan selected" });
      const p = planRows[0];

      const start = new Date();
      const end = addDays(start, (p.duration_months || 1) * 30 - 1);
      const hash = await bcrypt.hash(password, 10);
      
      await query(
        `INSERT INTO members (
          member_id, name, email, mobile, password_hash, role, is_active, 
          sub_plan_id, sub_plan_label, sub_meals, sub_price_per_month, sub_is_paid,
          sub_start_date, sub_end_date
        ) 
         VALUES ($1, $2, $3, $4, $5, 'member', FALSE, $6, $7, $8, $9, FALSE, $10, $11)`,
        [mid, name, email, mobile, hash, p.plan_id, p.label, p.meals, p.price_per_month, fmtDate(start), fmtDate(end)]
      );
      
      await delByPattern("member:list");
      
      // Dispatch welcome email asynchronously
      sendRegistrationReceivedEmail({ memberId: mid, name, email }).catch((err) => {
        console.error("[NOTIFY-ERROR] Failed to send registration email background:", err.message);
      });

      // Dispatch push notification to admins and staff
      sendPushToAdminsAndStaff({
        title: "New Registration 📝",
        body: `${name} (${mid}) has registered. Please activate their account.`,
        url: `/admin/members?search=${mid}`,
      }).catch((pushErr) => {
        console.error("[PUSH-ERROR] Failed to send push on registration:", pushErr.message);
      });
      
      res.status(201).json({ ok: true, message: "Registration successful. Please visit the mess office for activation." });
    } catch (e) { next(e); }
  });

router.post("/refresh", async (req, res) => {
  const rt = req.cookies?.rt;
  if (!rt) return res.status(401).json({ error: "No refresh token" });

  const isBlacklisted = await isTokenBlacklisted(rt);
  if (isBlacklisted) return res.status(401).json({ error: "Invalid refresh" });

  try {
    const payload = jwt.verify(rt, process.env.JWT_REFRESH_SECRET);
    const m = await findUser(payload.sub);
    if (!m) return res.status(401).json({ error: "Invalid refresh" });
    res.json({ accessToken: signAccess(m) });
  } catch { res.status(401).json({ error: "Invalid refresh" }); }
});

router.post("/logout", async (req, res, next) => {
  try {
    const rt = req.cookies?.rt;
    if (rt) {
      try {
        const decoded = jwt.decode(rt);
        if (decoded && decoded.exp) {
          const ttl = decoded.exp - Math.floor(Date.now() / 1000);
          if (ttl > 0) {
            await blacklistToken(rt, ttl);
          }
        }
      } catch (err) {
        console.error("[AUTH] Error blacklisting token on logout:", err.message);
      }
    }
    res.clearCookie("rt");
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.get("/me", verifyToken, async (req, res) => {
  const m = await findUser(req.user.sub, { activeOnly: false });
  if (!m) return res.status(404).json({ error: "Not found" });
  res.json(stripPassword(m));
});

router.post("/forgot-password",
  authLimiter,
  body("memberId").isString().trim().notEmpty(),
  async (req, res, next) => {
    try {
      const errs = validationResult(req);
      if (!errs.isEmpty()) return res.status(400).json({ error: "Invalid input" });
      const { memberId } = req.body;

      // Try finding the user
      let m = await findUser(memberId);
      if (!m) m = await findUser(memberId.toUpperCase());

      // If user not found, return a specific error message
      if (!m) {
        return res.status(404).json({ error: "No account found with this Member ID or Email." });
      }

      // Generate a secure 32-byte token
      const token = crypto.randomBytes(32).toString("hex");
      // Set expiration to 15 minutes from now
      const expires = new Date(Date.now() + 15 * 60 * 1000);

      // Save token in DB
      await query(
        `UPDATE members 
         SET reset_password_token = $1, reset_password_expires = $2 
         WHERE member_id = $3`,
        [token, expires, m.memberId]
      );

      // Construct reset link using env variable if available, fallback to origin or localhost
      const origin = process.env.FRONTEND_URL || req.headers.origin || "http://localhost:5173";
      const resetLink = `${origin}/reset-password?token=${token}&memberId=${m.memberId}`;

      // Dispatch password reset email
      await sendPasswordResetEmail(m, resetLink);

      res.json({ ok: true, message: "If an account exists, a reset link was sent." });
    } catch (e) { next(e); }
  }
);

router.post("/reset-password",
  authLimiter,
  body("memberId").isString().trim().notEmpty(),
  body("token").isString().trim().notEmpty(),
  body("newPassword")
    .isString()
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
    .withMessage("Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"),
  async (req, res, next) => {
    try {
      const errs = validationResult(req);
      if (!errs.isEmpty()) return res.status(400).json({ error: "Invalid input", details: errs.array() });
      
      const { memberId, token, newPassword } = req.body;

      const { rows } = await query(
        `SELECT * FROM members 
         WHERE member_id = $1 AND reset_password_token = $2 AND reset_password_expires > NOW()`,
        [memberId, token]
      );

      if (rows.length === 0) {
        return res.status(400).json({ error: "Invalid or expired reset token" });
      }

      const hash = await bcrypt.hash(newPassword, 10);

      await query(
        `UPDATE members 
         SET password_hash = $1, reset_password_token = NULL, reset_password_expires = NULL 
         WHERE member_id = $2`,
        [hash, memberId]
      );

      res.json({ ok: true, message: "Password updated successfully!" });
    } catch (e) { next(e); }
  }
);

router.post("/verify-email", verifyToken,
  body("otp").isString().trim().isLength({ min: 6, max: 6 }),
  async (req, res, next) => {
    try {
      const errs = validationResult(req);
      if (!errs.isEmpty()) return res.status(400).json({ error: "Verification code must be 6 digits" });

      const { otp } = req.body;
      const memberId = req.user.sub;

      const m = await findUser(memberId, { activeOnly: false });
      if (!m) return res.status(404).json({ error: "User not found" });

      if (m.emailVerified) {
        return res.status(400).json({ error: "Email already verified" });
      }

      const cachedOtp = await getCache(`messmate:member:${memberId}:email-otp`);
      if (!cachedOtp || cachedOtp !== otp) {
        return res.status(400).json({ error: "Invalid or expired verification code" });
      }

      // Update email_verified to true in Postgres
      await query(
        `UPDATE members SET email_verified = TRUE, updated_at = NOW() WHERE member_id = $1`,
        [memberId]
      );

      // Delete OTP from Redis
      await delCache(`messmate:member:${memberId}:email-otp`);
      // Delete user details cache
      await delCache([`messmate:member:${memberId}`, `messmate:member:${memberId}:subscription`]);
      await delByPattern("member:list");

      res.json({ ok: true, message: "Email verified successfully!" });
    } catch (e) { next(e); }
  }
);

router.post("/resend-verification", verifyToken, async (req, res, next) => {
  try {
    const memberId = req.user.sub;

    const m = await findUser(memberId, { activeOnly: false });
    if (!m) return res.status(404).json({ error: "User not found" });

    if (m.emailVerified) {
      return res.status(400).json({ error: "Email already verified" });
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await setCache(`messmate:member:${memberId}:email-otp`, otp, 300); // 5 minutes

    // Send email
    sendVerificationOTPEmail({ memberId: m.memberId, name: m.name, email: m.email }, otp).catch((err) => {
      console.error("[NOTIFY-ERROR] Failed to send verification email background:", err.message);
    });

    res.json({ ok: true, message: "Verification code resent successfully!" });
  } catch (e) { next(e); }
});

export default router;
