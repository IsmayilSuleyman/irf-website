/* IRF PWA service worker: web push -> notification banner + app-icon badge. */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_e) {
    data = {};
  }

  const title = data.title || "İsmayıl Rifah Fondu";
  const body = data.body || "";
  const url = data.url || "/";
  const unread = typeof data.unread === "number" ? data.unread : null;

  const showBanner = self.registration.showNotification(title, {
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    data: { url },
  });

  // Set the "1" (or unread count) on the installed app icon.
  let setBadge = Promise.resolve();
  if (unread != null && self.navigator && "setAppBadge" in self.navigator) {
    setBadge =
      unread > 0
        ? self.navigator.setAppBadge(unread)
        : self.navigator.clearAppBadge();
  }

  event.waitUntil(Promise.all([showBanner, setBadge]));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});
