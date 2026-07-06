import { describe, it, expect, beforeEach } from "vitest";
const notifications = require("./notifications.js");

describe("notifications - Unit Tests", () => {
  beforeEach(() => {
    // Reset the in-memory/localStorage store before each test
    const store = notifications.loadStore();
    store.notifications = [];
    store.lastEventAt = null;
    notifications.saveStore(store);
  });

  describe("pushNotification & Deduplication", () => {
    it("should push a new notification successfully", () => {
      const res = notifications.pushNotification({
        type: "info",
        title: "Welcome",
        message: "Welcome to LearnSphere!",
      });

      expect(res.inserted).toBe(true);
      expect(res.notification).toBeDefined();
      expect(res.notification.title).toBe("Welcome");
      expect(res.notification.deliveryState).toBe("pending");
      expect(res.notification.deliveredAt).toBeNull();
      expect(res.notification.readAt).toBeNull();
    });

    it("should prevent duplicate notifications with the same explicit ID", () => {
      const first = notifications.pushNotification({
        id: "test-id-1",
        type: "info",
        title: "Test",
        message: "Message",
      });
      expect(first.inserted).toBe(true);

      const second = notifications.pushNotification({
        id: "test-id-1",
        type: "info",
        title: "Different Title",
        message: "Different Message",
      });
      expect(second.inserted).toBe(false);
      expect(second.reason).toBe("duplicate_id");
    });

    it("should deduplicate by dedupeKey within a 24-hour window", () => {
      const first = notifications.pushNotification({
        type: "streak",
        title: "Streak Up!",
        message: "Your streak is 3 days",
        dedupeKey: "streak-key-1",
      });
      expect(first.inserted).toBe(true);

      const second = notifications.pushNotification({
        type: "streak",
        title: "Streak Up!",
        message: "Your streak is 3 days",
        dedupeKey: "streak-key-1",
      });
      expect(second.inserted).toBe(false);
      expect(second.reason).toBe("duplicate_dedupe_key");
    });

    it("should allow duplicate dedupeKey after 24 hours have passed", () => {
      notifications.pushNotification({
        type: "streak",
        title: "Streak Up!",
        message: "Your streak is 3 days",
        dedupeKey: "streak-key-1",
      });

      // Manually backdate the existing notification in store
      const store = notifications.loadStore();
      const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
      store.notifications[0].createdAt = oldTime;
      notifications.saveStore(store);

      const second = notifications.pushNotification({
        type: "streak",
        title: "Streak Up!",
        message: "Your streak is 3 days",
        dedupeKey: "streak-key-1",
      });
      expect(second.inserted).toBe(true);
    });

    it("should prevent rapid identical content submissions within 60 seconds", () => {
      const first = notifications.pushNotification({
        type: "info",
        title: "Alert",
        message: "Action required",
      });
      expect(first.inserted).toBe(true);

      const second = notifications.pushNotification({
        type: "info",
        title: "Alert",
        message: "Action required",
      });
      expect(second.inserted).toBe(false);
      expect(second.reason).toBe("duplicate_content_recent");
    });

    it("should allow identical content submissions if 60 seconds have passed", () => {
      notifications.pushNotification({
        type: "info",
        title: "Alert",
        message: "Action required",
      });

      // Manually backdate the existing notification
      const store = notifications.loadStore();
      const oldTime = new Date(Date.now() - 65 * 1000).toISOString();
      store.notifications[0].createdAt = oldTime;
      notifications.saveStore(store);

      const second = notifications.pushNotification({
        type: "info",
        title: "Alert",
        message: "Action required",
      });
      expect(second.inserted).toBe(true);
    });
  });

  describe("Delivery State Management", () => {
    it("should mark pending notifications as delivered", () => {
      notifications.pushNotification({
        type: "info",
        title: "Alert 1",
        message: "Action required",
      });

      let store = notifications.loadStore();
      expect(store.notifications[0].deliveryState).toBe("pending");
      expect(store.notifications[0].deliveredAt).toBeNull();

      notifications.markAllDelivered();

      store = notifications.loadStore();
      expect(store.notifications[0].deliveryState).toBe("delivered");
      expect(store.notifications[0].deliveredAt).not.toBeNull();
    });
  });

  describe("Read / Acknowledgment State Management", () => {
    it("should explicitly mark a notification as read by ID", () => {
      const n1 = notifications.pushNotification({ type: "t", title: "A", message: "A" }).notification;
      const n2 = notifications.pushNotification({ type: "t", title: "B", message: "B" }).notification;

      let store = notifications.loadStore();
      expect(store.notifications.find(n => n.id === n1.id).readAt).toBeNull();
      expect(store.notifications.find(n => n.id === n2.id).readAt).toBeNull();

      notifications.markReadById(n1.id);

      store = notifications.loadStore();
      expect(store.notifications.find(n => n.id === n1.id).readAt).not.toBeNull();
      expect(store.notifications.find(n => n.id === n2.id).readAt).toBeNull();
    });

    it("should mark all read", () => {
      const n1 = notifications.pushNotification({ type: "t", title: "A", message: "A" }).notification;
      const n2 = notifications.pushNotification({ type: "t", title: "B", message: "B" }).notification;

      notifications.markAllRead();

      const store = notifications.loadStore();
      expect(store.notifications.find(n => n.id === n1.id).readAt).not.toBeNull();
      expect(store.notifications.find(n => n.id === n2.id).readAt).not.toBeNull();
    });
  });
});
