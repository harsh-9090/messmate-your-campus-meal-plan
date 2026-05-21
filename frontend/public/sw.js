// Messmate PWA Service Worker for Push Notifications

self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const title = payload.title || "Mom's Kitchen";
    const options = {
      body: payload.body || "You have a new notification.",
      icon: "/android-chrome-192x192.png", // Use fallback or actual PWA assets if exist
      badge: "/favicon-32x32.png",
      vibrate: [100, 50, 100],
      data: {
        url: payload.url || "/dashboard",
      },
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    // If the data is plain text instead of JSON
    const text = event.data.text();
    const options = {
      body: text,
      icon: "/android-chrome-192x192.png",
      badge: "/favicon-32x32.png",
      data: {
        url: "/dashboard",
      },
    };

    event.waitUntil(self.registration.showNotification("Mom's Kitchen Notice", options));
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const clickUrl = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open, focus it
      for (const client of windowClients) {
        if (client.url.includes(clickUrl) && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(clickUrl);
      }
    })
  );
});
