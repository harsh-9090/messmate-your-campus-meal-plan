import { Router } from "express";
import { body, validationResult } from "express-validator";
import { verifyToken, requireRole } from "../middleware/authMiddleware.js";
import { scanLimiter } from "../middleware/rateLimiter.js";
import { verifyQRToken } from "../services/qrService.js";
import { Member } from "../models/Member.js";
import { ScanLog } from "../models/ScanLog.js";
import { validateAndRecord } from "../services/scanValidator.js";
import { format } from "date-fns";

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
        await ScanLog.create({
          status: "denied", denialCode: "INVALID_TOKEN",
          denialReason: "Invalid or expired QR code", meal,
          date: format(new Date(), "yyyy-MM-dd"), timestamp: new Date(),
          scannedBy: req.user.sub,
        });
        return res.status(200).json({ status: "denied", code: "INVALID_TOKEN", reason: "Invalid or expired QR code", meal });
      }

      const member = await Member.findOne({ memberId: decoded.userId, isActive: true });
      const result = await validateAndRecord({
        member, meal, scannedBy: req.user.sub, deviceInfo: req.headers["user-agent"],
      });
      res.json(result);
    } catch (e) { next(e); }
  });

export default router;
