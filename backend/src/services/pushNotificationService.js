import webpush from "web-push";
import { initializeApp, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import fs from "fs";
import path from "path";
import { query } from "../db/index.js";

// Initialize Firebase Admin SDK
let firebaseApp = null;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('ascii'));
    firebaseApp = initializeApp({
      credential: cert(serviceAccount)
    });
    console.log("[PUSH] Firebase Admin SDK initialized successfully via Environment Variable");
  } else {
    const serviceAccountPath = path.resolve(process.cwd(), "firebase-adminsdk.json");
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
      firebaseApp = initializeApp({
        credential: cert(serviceAccount)
      });
      console.log("[PUSH] Firebase Admin SDK initialized successfully via local JSON file");
    } else {
      console.warn("⚠️ [PUSH] FIREBASE_SERVICE_ACCOUNT_BASE64 env var or firebase-adminsdk.json not found. Android native push will not function.");
    }
  }
} catch (err) {
  console.error("❌ CRITICAL: Failed to initialize Firebase Admin SDK", err);
}

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || "mailto:admin@momskitchen.com";

if (!publicKey || !privateKey) {
  if (process.env.NODE_ENV === "production") {
    console.error("❌ CRITICAL: VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be configured in production environment variables!");
    process.exit(1);
  } else {
    console.warn("⚠️ [PUSH] VAPID keys not configured in environment. Web push notifications will not function.");
  }
}

if (publicKey && privateKey) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export function getVapidPublicKey() {
  return publicKey || null;
}

/**
 * Dispatch a web push notification to a specific member.
 */
export async function sendPushToMember(memberId, payload) {
  try {
    const { rows } = await query(
      "SELECT id, endpoint, p256dh, auth, client_type FROM push_subscriptions WHERE member_id = $1",
      [memberId]
    );

    if (rows.length === 0) {
      console.log(`[PUSH] No active push subscriptions for member ${memberId}`);
      return;
    }

    console.log(`[PUSH] Dispatching notification to ${rows.length} devices for member ${memberId}`);
    
    const notificationPayload = typeof payload === "string" ? payload : JSON.stringify(payload);

    const promises = rows.map(async (sub) => {
      try {
        if (sub.client_type === 'android') {
          // Dispatch via Firebase Cloud Messaging
          if (!firebaseApp) throw new Error("Firebase Admin SDK not initialized");
          
          let parsedPayload;
          try { parsedPayload = JSON.parse(notificationPayload); } catch { parsedPayload = { title: "New Notification", body: notificationPayload }; }
          
          await getMessaging().send({
            token: sub.endpoint, // We saved FCM token in endpoint col
            notification: {
              title: parsedPayload.title || "Mom's Kitchen",
              body: parsedPayload.body || notificationPayload
            },
            data: {
              url: parsedPayload.url || "/",
              payload: notificationPayload
            }
          });
        } else {
          // Dispatch via Web Push
          await webpush.sendNotification({
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          }, notificationPayload);
        }
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404 || err.code === 'messaging/registration-token-not-registered') {
          console.log(`[PUSH] Subscription is inactive (statusCode: ${err.statusCode || err.code}). Deleting subscription id: ${sub.id}`);
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
      `SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth, ps.client_type, m.member_id 
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
      try {
        if (sub.client_type === 'android') {
          if (!firebaseApp) throw new Error("Firebase Admin SDK not initialized");
          let parsedPayload;
          try { parsedPayload = JSON.parse(notificationPayload); } catch { parsedPayload = { title: "New Notification", body: notificationPayload }; }
          await getMessaging().send({
            token: sub.endpoint,
            notification: {
              title: parsedPayload.title || "Mom's Kitchen",
              body: parsedPayload.body || notificationPayload
            },
            data: { url: parsedPayload.url || "/", payload: notificationPayload }
          });
        } else {
          await webpush.sendNotification({
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          }, notificationPayload);
        }
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404 || err.code === 'messaging/registration-token-not-registered') {
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
      `SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth, ps.client_type, m.member_id 
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
      try {
        if (sub.client_type === 'android') {
          if (!firebaseApp) throw new Error("Firebase Admin SDK not initialized");
          let parsedPayload;
          try { parsedPayload = JSON.parse(notificationPayload); } catch { parsedPayload = { title: "New Notification", body: notificationPayload }; }
          await getMessaging().send({
            token: sub.endpoint,
            notification: {
              title: parsedPayload.title || "Mom's Kitchen",
              body: parsedPayload.body || notificationPayload
            },
            data: { url: parsedPayload.url || "/", payload: notificationPayload }
          });
        } else {
          await webpush.sendNotification({
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          }, notificationPayload);
        }
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404 || err.code === 'messaging/registration-token-not-registered') {
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
      `SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth, ps.client_type, m.member_id 
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
      try {
        if (sub.client_type === 'android') {
          if (!firebaseApp) throw new Error("Firebase Admin SDK not initialized");
          let parsedPayload;
          try { parsedPayload = JSON.parse(notificationPayload); } catch { parsedPayload = { title: "New Notification", body: notificationPayload }; }
          await getMessaging().send({
            token: sub.endpoint,
            notification: {
              title: parsedPayload.title || "Mom's Kitchen",
              body: parsedPayload.body || notificationPayload
            },
            data: { url: parsedPayload.url || "/", payload: notificationPayload }
          });
        } else {
          await webpush.sendNotification({
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          }, notificationPayload);
        }
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404 || err.code === 'messaging/registration-token-not-registered') {
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
