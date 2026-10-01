// Taxi DJ service worker: shows push notifications for new song requests.
// It does not cache pages or intercept network requests.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Taxi DJ", body: event.data ? event.data.text() : "" };
  }
  const options = {
    body: data.body || "",
    icon: "/icons/192",
    badge: "/icons/192",
    tag: data.tag || "taxidj",
    renotify: true,
    vibrate: [120, 60, 120],
    data: { url: data.url || "/", playUrl: data.playUrl || null },
  };
  // Android: a button to play the song straight in YouTube Music.
  if (data.playUrl) options.actions = [{ action: "play", title: "▶ Play in YouTube Music" }];
  event.waitUntil(self.registration.showNotification(data.title || "Taxi DJ", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const { url, playUrl } = event.notification.data || {};
  if (event.action === "play" && playUrl) {
    event.waitUntil(self.clients.openWindow(playUrl));
    return;
  }
  const target = new URL(url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      // Reuse an open Taxi DJ window if there is one.
      for (const w of windows) {
        if (new URL(w.url).origin === self.location.origin && "focus" in w) {
          return w.focus().then((c) => (c && "navigate" in c ? c.navigate(target) : c));
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
