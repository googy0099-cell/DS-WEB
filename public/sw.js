// handle push from server (Web Push API)
self.addEventListener("push", (event) => {
  let data = { title: "🔔 ออเดอร์ใหม่!", body: "มีออเดอร์รอรับ", tag: "order-alert" };
  try { data = { ...data, ...event.data?.json() }; } catch {}

  const isAppointment = data.tag === "appointment" || data.title?.startsWith("📌");
  const tag = isAppointment ? "appointment-alert" : "order-alert";

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/DS-new-logo.png",
      badge: "/DS-new-logo.png",
      tag,
      renotify: true,
      requireInteraction: isAppointment,
      vibrate: isAppointment ? [300, 100, 300] : [200, 100, 200, 100, 200],
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
  const isAppointment = event.notification.tag === "appointment-alert";
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((list) => {
      const target = isAppointment ? "/admin/hr/payment-calendar" : "/admin";
      const existing = list.find((c) => c.url.includes(isAppointment ? "payment-calendar" : "/admin"));
      if (existing) return existing.focus();
      return clients.openWindow(target);
    })
  );
});
