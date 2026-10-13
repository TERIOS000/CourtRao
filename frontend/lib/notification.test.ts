import { describe, expect, it } from "vitest";
import { isActiveNotification, notificationText, type BoardNotification } from "./notification";

const item: BoardNotification = {
  id: "one", type: "booking-reminder", dayId: "2026-07-22", time: "18:00",
  createdAt: new Date("2026-07-22T08:00:00Z"),
  expiresAt: new Date("2026-07-29T08:00:00Z"), read: false,
  reminderSlots: [
    { time: "18:00", courts: ["C1", "C2"] },
    { time: "20:00", courts: ["C4"] },
  ],
};

describe("notifications", () => {
  it("filters expired records", () => {
    expect(isActiveNotification(item.expiresAt, new Date("2026-07-29T07:59:59Z"))).toBe(true);
    expect(isActiveNotification(item.expiresAt, new Date("2026-07-29T08:00:00Z"))).toBe(false);
  });

  it("combines all occupied slots in a daily reminder", () => {
    const result = notificationText(item, "en");
    expect(result.body).toBe("22 Jul\n18:00 C1, C2\n20:00 C4");
  });

  it("formats daily reminders in Thai", () => {
    expect(notificationText(item, "th")).toEqual({
      title: "เตือนการจองคอร์ท",
      body: "22 ก.ค.\n18:00 C1, C2\n20:00 C4",
    });
  });
});
