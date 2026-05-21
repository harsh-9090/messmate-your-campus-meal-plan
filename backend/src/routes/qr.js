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
    
    // Fetch user's active plan subscription meals
    const { rows } = await query(
      `SELECT sub_meals FROM members WHERE member_id = $1 AND is_active = TRUE`,
      [memberId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: "No active subscription found" });
    }
    
    const allowedMeals = rows[0].sub_meals || [];
    
    // Check if today is a scheduled active holiday and which meals are blocked
    const todayStr = getISTDateStr();
    const holidayRes = await query(
      `SELECT content, block_breakfast, block_lunch, block_dinner
       FROM dashboard_notifications 
       WHERE type = 'holiday' AND holiday_date = $1 AND is_active = TRUE`,
      [todayStr]
    );
    
    const blockedMeals = new Set();
    let holidayReason = "Mess is closed";
    for (const row of holidayRes.rows) {
      holidayReason = row.content;
      if (row.block_breakfast) blockedMeals.add("Breakfast");
      if (row.block_lunch) blockedMeals.add("Lunch");
      if (row.block_dinner) blockedMeals.add("Dinner");
    }
    
    // Fetch user's registered skips for today
    const skipsRes = await query(
      `SELECT meal FROM meal_skips WHERE member_id = $1 AND skip_date = $2`,
      [memberId, todayStr]
    );
    const skippedMeals = new Set(skipsRes.rows.map(r => r.meal));
    
    // If all allowed meals in user's subscription are blocked, deny access
    if (allowedMeals.length > 0 && allowedMeals.every(m => blockedMeals.has(m))) {
      return res.status(403).json({ error: "MESS_CLOSED", reason: holidayReason });
    }
    
    const tokens = {};
    
    // Generate static daily token for each allowed meal in the user's plan
    for (const meal of ["Breakfast", "Lunch", "Dinner"]) {
      if (allowedMeals.includes(meal) && !blockedMeals.has(meal) && !skippedMeals.has(meal)) {
        tokens[meal] = generateQRToken(memberId, meal).token;
      }
    }
    
    res.json({
      tokens,
      blockedMeals: Array.from(blockedMeals),
      skippedMeals: Array.from(skippedMeals),
      holidayReason,
      date: getISTDateStr()
    });
  } catch (e) {
    next(e);
  }
});

export default router;
