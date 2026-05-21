import { Router } from "express";
import { query } from "../db/index.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { getVapidPublicKey } from "../services/pushNotificationService.js";

const router = Router();

// Retrieve public VAPID key
router.get("/vapid-key", verifyToken, (req, res) => {
  res.json({ publicKey: getVapidPublicKey() });
});

// Subscribe to push notifications
router.post("/subscribe", verifyToken, async (req, res, next) => {
  try {
    const memberId = req.user.memberId;
    const { endpoint, keys } = req.body;

    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({ error: "Invalid push subscription object" });
    }

    // Upsert subscription for this member & endpoint
    await query(
      `INSERT INTO push_subscriptions (member_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) 
       DO UPDATE SET member_id = EXCLUDED.member_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
      [memberId, endpoint, keys.p256dh, keys.auth]
    );

    console.log(`[PUSH] Subscribed endpoint for member: ${memberId}`);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Unsubscribe from push notifications
router.post("/unsubscribe", verifyToken, async (req, res, next) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({ error: "Endpoint is required" });
    }

    await query("DELETE FROM push_subscriptions WHERE endpoint = $1", [endpoint]);

    console.log(`[PUSH] Unsubscribed endpoint`);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
