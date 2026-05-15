import { Router } from "express";
import { verifyToken, requireRole } from "../middleware/authMiddleware.js";
import { qrLimiter } from "../middleware/rateLimiter.js";
import { generateQRToken } from "../services/qrService.js";

const router = Router();
router.use(verifyToken, requireRole("member"), qrLimiter);

router.get("/token", (req, res) => {
  const { token, expiresIn } = generateQRToken(req.user.sub);
  res.json({ token, expiresIn });
});

export default router;
