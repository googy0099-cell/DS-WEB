// handle push from server (Web Push API)
self.addEventListener("push", (event) => {
  let data = { title: "🔔 ออเดอร์ใหม่!", body: "มีออเดอร์รอรับ" };
  try { data = event.data?.json() ?? data; } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/DS-new-logo.png",
      badge: "/DS-new-logo.png",
      tag: "order-alert",
      renotify: true,
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 200],
    })
  );
});

// handle postMessage from page (fallback เมื่อ tab เปิดอยู่)
self.addEventListener("message", (event) => {
  if (event.data?.type === "ORDER_ALERT") {
    self.registration.showNotification("🔔 ออเดอร์ใหม่เข้า!", {
      body: event.data.body ?? "มีออเดอร์รอรับ",
      icon: "/DS-new-logo.png",
      badge: "/DS-new-logo.png",
      tag: "order-alert",
      renotify: true,
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 200],
    });
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((list) => {
      const adminTab = list.find((c) => c.url.includes("/admin"));
      if (adminTab) return adminTab.focus();
      return clients.openWindow("/admin");
    })
  );
});
