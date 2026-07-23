import { pushApi } from "./api";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function checkAndRegisterPush() {
  if (typeof window === "undefined") return;
  
  if (Capacitor.isNativePlatform()) {
    try {
      // Native Android/iOS push via FCM
      let permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive === "prompt") {
        permStatus = await PushNotifications.requestPermissions();
      }
      if (permStatus.receive !== "granted") {
        console.warn("[PUSH] Native push permission denied.");
        return;
      }

      await PushNotifications.register();

      PushNotifications.addListener("registration", async (token) => {
        console.log("[PUSH] Native FCM token received:", token.value);
        await pushApi.subscribe({ type: "android", token: token.value });
      });

      PushNotifications.addListener("registrationError", (error) => {
        console.error("[PUSH-ERROR] Failed to register native push:", error);
      });
      return;
    } catch (err: any) {
      console.error("[PUSH-ERROR] Native push setup failed:", err.message || err);
      return;
    }
  }

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("[PUSH] Push notifications or service workers are not supported by this browser.");
    return;
  }

  try {
    // 1. Register Service Worker
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    console.log("[PUSH] Service Worker registered with scope:", registration.scope);

    // Ensure the service worker is ready
    await navigator.serviceWorker.ready;

    // 2. Check if we are already subscribed
    let subscription = await registration.pushManager.getSubscription();

    // If subscribed, sync with the backend to verify the token is registered
    if (subscription) {
      console.log("[PUSH] User is already subscribed. Syncing subscription with backend.");
      await pushApi.subscribe(subscription);
      return;
    }

    // 3. Request permissions
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("[PUSH] Notification permission denied or dismissed.");
      return;
    }

    // 4. Fetch the VAPID key from the server
    const { publicKey } = await pushApi.getVapidKey();
    const applicationServerKey = urlBase64ToUint8Array(publicKey);

    // 5. Subscribe
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    console.log("[PUSH] Created new push subscription endpoint.");

    // 6. Send subscription to server
    await pushApi.subscribe(subscription);
    console.log("[PUSH] Subscription synced successfully.");
  } catch (err: any) {
    console.error("[PUSH-ERROR] Failed to setup push notifications:", err.message || err);
  }
}
