import { Router } from "express";
import { verifyToken, requireRole } from "../middleware/authMiddleware.js";
import { qrLimiter } from "../middleware/rateLimiter.js";
import { generateQRToken, getISTDateStr } from "../services/qrService.js";
import { query } from "../db/index.js";

const router = Router();
router.use(verifyToken, requireRole("member"), qrLimiter);

router.get("/token", async (req, res, next) => {
  try {
    const memberId = req.user.sub;
    
    // Check if today is a scheduled active holiday
    const todayStr = getISTDateStr();
    const holidayRes = await query(
      `SELECT content FROM dashboard_notifications 
       WHERE type = 'holiday' AND holiday_date = $1 AND is_active = TRUE LIMIT 1`,
      [todayStr]
    );
    if (holidayRes.rows.length > 0) {
      return res.status(403).json({ error: "MESS_CLOSED", reason: holidayRes.rows[0].content });
    }
    
    // Fetch user's active plan subscription meals
    const { rows } = await query(
      `SELECT sub_meals FROM members WHERE member_id = $1 AND is_active = TRUE`,
      [memberId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: "No active subscription found" });
    }
    
    const allowedMeals = rows[0].sub_meals || [];
    const tokens = {};
    
    // Generate static daily token for each allowed meal in the user's plan
    for (const meal of ["Breakfast", "Lunch", "Dinner"]) {
      if (allowedMeals.includes(meal)) {
        tokens[meal] = generateQRToken(memberId, meal).token;
      }
    }
    
    res.json({
      tokens,
      date: getISTDateStr()
    });
  } catch (e) {
    next(e);
  }
});

export default router;
