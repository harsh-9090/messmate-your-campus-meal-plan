import webpush from "web-push";
import { query } from "../db/index.js";

// Auto-generate or get VAPID keys
let vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
};

// Check if we need to auto-generate keys (helpful for local dev or first-time setup)
if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
  console.warn("[PUSH] VAPID keys not configured in environment. Generating temporary keys...");
  const keys = webpush.generateVAPIDKeys();
  vapidKeys.publicKey = keys.publicKey;
  vapidKeys.privateKey = keys.privateKey;
}

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:admin@momskitchen.com",
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

export function getVapidPublicKey() {
  return vapidKeys.publicKey;
}

/**
 * Dispatch a web push notification to a specific member.
 */
export async function sendPushToMember(memberId, payload) {
  try {
    const { rows } = await query(
      "SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE member_id = $1",
      [memberId]
    );

    if (rows.length === 0) {
      console.log(`[PUSH] No active push subscriptions for member ${memberId}`);
      return;
    }

    console.log(`[PUSH] Dispatching notification to ${rows.length} devices for member ${memberId}`);
    
    const notificationPayload = typeof payload === "string" ? payload : JSON.stringify(payload);

    const promises = rows.map(async (sub) => {
      const subscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(subscription, notificationPayload);
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log(`[PUSH] Subscription is inactive (statusCode: ${err.statusCode}). Deleting subscription id: ${sub.id}`);
          await query("DELETE FROM push_subscriptions WHERE id = $1", [sub.id]);
        } else {
          console.error(`[PUSH-ERROR] Failed to send push to subscription id ${sub.id}:`, err.message);
        }
      }
    });

    await Promise.all(promises);
  } catch (err) {
    console.error(`[PUSH-ERROR] Failed to dispatch push notifications for member ${memberId}:`, err.message);
  }
}

/**
 * Send a web push notification to all admins and staff.
 */
export async function sendPushToAdminsAndStaff(payload) {
  try {
    const { rows } = await query(
      `SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth, m.member_id 
       FROM push_subscriptions ps
       JOIN members m ON ps.member_id = m.member_id
       WHERE m.role IN ('admin', 'staff')`
    );

    if (rows.length === 0) {
      console.log(`[PUSH] No active push subscriptions for Admin/Staff`);
      return;
    }

    console.log(`[PUSH] Dispatching notification to ${rows.length} devices for Admin/Staff`);

    const notificationPayload = typeof payload === "string" ? payload : JSON.stringify(payload);

    const promises = rows.map(async (sub) => {
      const subscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(subscription, notificationPayload);
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log(`[PUSH] Admin/Staff subscription inactive. Deleting subscription id: ${sub.id}`);
          await query("DELETE FROM push_subscriptions WHERE id = $1", [sub.id]);
        } else {
          console.error(`[PUSH-ERROR] Failed to send push to admin/staff subscription id ${sub.id}:`, err.message);
        }
      }
    });

    await Promise.all(promises);
  } catch (err) {
    console.error(`[PUSH-ERROR] Failed to dispatch push notifications for Admin/Staff:`, err.message);
  }
}

/**
 * Send a web push notification only to admins (not staff).
 */
export async function sendPushToAdmins(payload) {
  try {
    const { rows } = await query(
      `SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth, m.member_id 
       FROM push_subscriptions ps
       JOIN members m ON ps.member_id = m.member_id
       WHERE m.role = 'admin'`
    );

    if (rows.length === 0) {
      console.log(`[PUSH] No active push subscriptions for Admins`);
      return;
    }

    console.log(`[PUSH] Dispatching notification to ${rows.length} devices for Admins`);

    const notificationPayload = typeof payload === "string" ? payload : JSON.stringify(payload);

    const promises = rows.map(async (sub) => {
      const subscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(subscription, notificationPayload);
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log(`[PUSH] Admin subscription inactive. Deleting subscription id: ${sub.id}`);
          await query("DELETE FROM push_subscriptions WHERE id = $1", [sub.id]);
        } else {
          console.error(`[PUSH-ERROR] Failed to send push to admin subscription id ${sub.id}:`, err.message);
        }
      }
    });

    await Promise.all(promises);
  } catch (err) {
    console.error(`[PUSH-ERROR] Failed to dispatch push notifications for Admins:`, err.message);
  }
}

/**
 * Send a web push notification to all active student members.
 */
export async function sendPushToAllMembers(payload) {
  try {
    const { rows } = await query(
      `SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth, m.member_id 
       FROM push_subscriptions ps
       JOIN members m ON ps.member_id = m.member_id
       WHERE m.role = 'member' AND m.is_active = TRUE`
    );

    if (rows.length === 0) {
      console.log(`[PUSH] No active push subscriptions for student members`);
      return;
    }

    console.log(`[PUSH] Dispatching notification to ${rows.length} devices for student members`);

    const notificationPayload = typeof payload === "string" ? payload : JSON.stringify(payload);

    const promises = rows.map(async (sub) => {
      const subscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(subscription, notificationPayload);
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log(`[PUSH] Student member subscription inactive. Deleting subscription id: ${sub.id}`);
          await query("DELETE FROM push_subscriptions WHERE id = $1", [sub.id]);
        } else {
          console.error(`[PUSH-ERROR] Failed to send push to student member subscription id ${sub.id}:`, err.message);
        }
      }
    });

    await Promise.all(promises);
  } catch (err) {
    console.error(`[PUSH-ERROR] Failed to dispatch push notifications for student members:`, err.message);
  }
}
