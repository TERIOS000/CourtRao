import { describe, expect, it } from "vitest";
import {
  clearBoardSlot,
  createDateRange,
  formatDateRange,
  formatUpdatedAt,
  mergeBoardRecords,
  updateBoardSlot,
} from "./board";

describe("board domain", () => {
  it("creates seven Bangkok dates with ISO ids and DD/MM/YYYY display values", () => {
    const days = createDateRange("en", new Date("2026-07-19T18:30:00Z"));
    expect(days).toHaveLength(7);
    expect(days[0]).toMatchObject({ id: "2026-07-20", displayDate: "20/07/2026", isToday: true });
    expect(days[6].id).toBe("2026-07-26");
    expect(days.every((day) => day.slots.length === 3)).toBe(true);
  });

  it("crosses month and year boundaries", () => {
    const days = createDateRange("en", new Date("2026-12-30T18:00:00Z"));
    expect(days.map((day) => day.id)).toEqual([
      "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03", "2027-01-04", "2027-01-05", "2027-01-06",
    ]);
  });

  it("updates, sorts, and clears a slot immutably", () => {
    const days = createDateRange("en", new Date("2026-07-20T05:00:00Z"));
    const updated = updateBoardSlot(days, days[0].id, "19:00", ["C4", "C2"], []);
    expect(updated[0].slots[1].courts).toEqual(["C2", "C4"]);
    expect(days[0].slots[1].courts).toEqual([]);
    expect(clearBoardSlot(updated, days[0].id, "19:00")[0].slots[1].courts).toEqual([]);
  });

  it("merges stored records into an empty date range", () => {
    const days = createDateRange("en", new Date("2026-07-20T05:00:00Z"));
    const merged = mergeBoardRecords(days, [{
      dayId: days[0].id, time: "18:00", courts: ["C3"], qrImages: [], updatedAt: null, updatedBy: null,
    }]);
    expect(merged[0].slots[0].courts).toEqual(["C3"]);
    expect(merged[0].slots[1].courts).toEqual([]);
  });

  it("formats a compact localized visible range", () => {
    const days = createDateRange("en", new Date("2026-07-20T05:00:00Z"));
    expect(formatDateRange(days, "en")).toMatch(/^20\s–\s26 Jul 2026$/);
  });

  it("keeps both months when the visible range crosses a month", () => {
    const days = createDateRange("en", new Date("2026-09-30T05:00:00Z"));
    expect(formatDateRange(days, "en")).toMatch(/^30 Sept\s–\s6 Oct 2026$/);
  });

  describe("updated-at formatting", () => {
    it("shows only the time for an update today", () => {
      expect(formatUpdatedAt(
        new Date("2026-07-21T07:30:00Z"),
        "en",
        new Date("2026-07-21T15:00:00Z")
      )).toBe("14:30");
    });

    it("shows singular and plural calendar-day ages without a time", () => {
      const now = new Date("2026-07-21T05:00:00Z");
      expect(formatUpdatedAt(new Date("2026-07-20T16:00:00Z"), "en", now)).toBe("1 day ago");
      expect(formatUpdatedAt(new Date("2026-07-19T16:00:00Z"), "en", now)).toBe("2 days ago");
    });

    it("uses Bangkok midnight when calculating the day age", () => {
      const now = new Date("2026-07-20T17:05:00Z");
      expect(formatUpdatedAt(new Date("2026-07-20T16:55:00Z"), "en", now)).toBe("1 day ago");
    });

    it("localizes older Thai updates", () => {
      expect(formatUpdatedAt(
        new Date("2026-07-19T05:00:00Z"),
        "th",
        new Date("2026-07-21T05:00:00Z")
      )).toBe("2 วันที่แล้ว");
    });

    it("shows the time for future timestamps", () => {
      expect(formatUpdatedAt(
        new Date("2026-07-22T07:30:00Z"),
        "en",
        new Date("2026-07-21T05:00:00Z")
      )).toBe("14:30");
    });
  });
});
