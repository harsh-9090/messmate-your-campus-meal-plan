import { Router } from "express";
import { body, validationResult } from "express-validator";
import { format } from "date-fns";
import { verifyToken, requireRole } from "../middleware/authMiddleware.js";
import { scanLimiter } from "../middleware/rateLimiter.js";
import { verifyQRToken } from "../services/qrService.js";
import { query, rowToMember } from "../db/index.js";
import { validateAndRecord } from "../services/scanValidator.js";

const router = Router();
router.use(verifyToken, requireRole("staff", "admin"), scanLimiter);

router.post("/validate",
  body("qrToken").isString().notEmpty(),
  body("meal").isIn(["Breakfast", "Lunch", "Dinner"]),
  async (req, res, next) => {
    try {
      const errs = validationResult(req);
      if (!errs.isEmpty()) return res.status(400).json({ error: "Invalid input", details: errs.array() });
      const { qrToken, meal } = req.body;
      const decoded = verifyQRToken(qrToken);
      if (!decoded) {
        await query(
          `INSERT INTO scan_logs (meal, date, ts, status, denial_code, denial_reason, scanned_by)
           VALUES ($1, $2, NOW(), 'denied', 'INVALID_TOKEN', 'Invalid or expired QR code', $3)`,
          [meal, format(new Date(), "yyyy-MM-dd"), req.user.sub]
        );
        return res.status(200).json({ status: "denied", code: "INVALID_TOKEN", reason: "Invalid or expired QR code", meal });
      }

      const { rows } = await query(
        `SELECT * FROM members WHERE member_id = $1 AND is_active = TRUE`,
        [decoded.userId]
      );
      const member = rowToMember(rows[0]);
      const result = await validateAndRecord({
        member, meal, scannedBy: req.user.sub, deviceInfo: req.headers["user-agent"],
      });
      res.json(result);
    } catch (e) { next(e); }
  });

export default router;
