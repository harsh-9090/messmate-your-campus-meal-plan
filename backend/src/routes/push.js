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
    const memberId = req.user.sub;
    const { endpoint, keys, type, token } = req.body;

    if (type === "android") {
      if (!token) {
        return res.status(400).json({ error: "Invalid android push token" });
      }
      await query(
        `INSERT INTO push_subscriptions (member_id, endpoint, client_type)
         VALUES ($1, $2, 'android')
         ON CONFLICT (endpoint) 
         DO UPDATE SET member_id = EXCLUDED.member_id, client_type = 'android'`,
        [memberId, token]
      );
      console.log(`[PUSH] Subscribed Android FCM token for member: ${memberId}`);
      return res.json({ ok: true });
    }

    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({ error: "Invalid web push subscription object" });
    }

    // Upsert subscription for this member & endpoint
    await query(
      `INSERT INTO push_subscriptions (member_id, endpoint, p256dh, auth, client_type)
       VALUES ($1, $2, $3, $4, 'web')
       ON CONFLICT (endpoint) 
       DO UPDATE SET member_id = EXCLUDED.member_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, client_type = 'web'`,
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
