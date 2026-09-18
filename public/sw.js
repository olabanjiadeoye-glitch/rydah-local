const CACHE_NAME = "rydah-shell-v2";
const SHELL = ["/", "/rydah-icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname === "/rydah-icon.svg" || url.pathname === "/manifest.webmanifest") {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached || fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
      )
    );
  }
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "Rydah Local",
    body: "You have a new Rydah update.",
    url: "/notifications",
    icon: "/rydah-icon.svg",
    badge: "/rydah-icon.svg",
  };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      const text = event.data.text();
      if (text) payload.body = text;
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "Rydah Local", {
      body: payload.body || "You have a new Rydah update.",
      icon: payload.icon || "/rydah-icon.svg",
      badge: payload.badge || "/rydah-icon.svg",
      data: {
        url: payload.url || "/notifications",
      },
      tag: "rydah-notification",
      renotify: true,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const requestedPath = event.notification?.data?.url || "/notifications";
  const targetUrl = new URL(requestedPath, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clientList) => {
      for (const client of clientList) {
        try {
          const clientUrl = new URL(client.url);
          if (clientUrl.origin !== self.location.origin) continue;

          if ("navigate" in client) {
            await client.navigate(targetUrl);
          }
          if ("focus" in client) {
            await client.focus();
          }
          return;
        } catch {
          // Try the next controlled window.
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })
  );
});
