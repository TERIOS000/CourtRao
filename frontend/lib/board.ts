export type Language = "en" | "th";

export const allowedCourts = ["C1", "C2", "C3", "C4", "C5"] as const;
export type Court = (typeof allowedCourts)[number];

export const allowedSlotTimes = ["18:00", "19:00", "20:00"] as const;
export type SlotTime = (typeof allowedSlotTimes)[number];

export type QrImage = {
  name: string;
  url: string;
  path?: string;
  file?: File;
};

export type Slot = {
  time: SlotTime;
  courts: Court[];
  qrImages: QrImage[];
  updatedAt: Date | null;
  updatedBy: string | null;
};

export type SlotRecord = Slot & { dayId: string };

export type Day = {
  id: string;
  displayDate: string;
  label: string;
  isToday: boolean;
  slots: Slot[];
};

export const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
export const maxImageSize = 5 * 1024 * 1024;
export const boardTimeZone = "Asia/Bangkok";

const dayInMilliseconds = 24 * 60 * 60 * 1000;
const sampleCourts: Court[][][] = [
  [["C4"], ["C3", "C4"], []],
  [["C4"], ["C4"], []],
  [["C4"], [], ["C4"]],
  [["C4"], ["C2"], []],
  [[], ["C4"], []],
  [[], ["C4"], []],
  [[], ["C4"], []],
];

function getBangkokDate(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: boardTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), 12));
}

function formatIsoDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function formatDisplayDate(date: Date) {
  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

function emptySlots(): Slot[] {
  return allowedSlotTimes.map((time) => ({
    time,
    courts: [],
    qrImages: [],
    updatedAt: null,
    updatedBy: null,
  }));
}

export function createDateRange(language: Language, now = new Date()): Day[] {
  const today = getBangkokDate(now);
  const formatter = new Intl.DateTimeFormat(language === "th" ? "th-TH" : "en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "short",
  });

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.getTime() + index * dayInMilliseconds);
    return {
      id: formatIsoDate(date),
      displayDate: formatDisplayDate(date),
      label: formatter.format(date),
      isToday: index === 0,
      slots: emptySlots(),
    };
  });
}

export function createSampleRecords(language: Language, now = new Date()): SlotRecord[] {
  return createDateRange(language, now).flatMap((day, dayIndex) =>
    allowedSlotTimes.map((time, slotIndex) => ({
      dayId: day.id,
      time,
      courts: [...sampleCourts[dayIndex][slotIndex]],
      qrImages: [],
      updatedAt: null,
      updatedBy: null,
    }))
  );
}

export function mergeBoardRecords(days: Day[], records: SlotRecord[]): Day[] {
  const recordMap = new Map(records.map((record) => [`${record.dayId}/${record.time}`, record]));
  return days.map((day) => ({
    ...day,
    slots: day.slots.map((slot) => {
      const record = recordMap.get(`${day.id}/${slot.time}`);
      return record ? { ...record, courts: [...record.courts], qrImages: [...record.qrImages] } : slot;
    }),
  }));
}

export function updateBoardSlot(
  days: Day[],
  dayId: string,
  time: SlotTime,
  courts: Court[],
  qrImages: QrImage[],
  updatedAt: Date | null = new Date(),
  updatedBy: string | null = null
): Day[] {
  return days.map((day) =>
    day.id !== dayId
      ? day
      : {
          ...day,
          slots: day.slots.map((slot) =>
            slot.time === time
              ? { ...slot, courts: [...courts].sort(), qrImages: [...qrImages], updatedAt, updatedBy }
              : slot
          ),
        }
  );
}

export function clearBoardSlot(days: Day[], dayId: string, time: SlotTime) {
  return updateBoardSlot(days, dayId, time, [], []);
}

export function formatDateRange(days: Day[], language: Language) {
  if (days.length === 0) return "";
  const formatter = new Intl.DateTimeFormat(language === "th" ? "th-TH" : "en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return formatter.formatRange(new Date(`${days[0].id}T12:00:00Z`), new Date(`${days.at(-1)!.id}T12:00:00Z`));
}

export function formatUpdatedAt(updatedAt: Date, language: Language, now = new Date()) {
  const updatedDate = getBangkokDate(updatedAt);
  const currentDate = getBangkokDate(now);
  const daysAgo = Math.floor((currentDate.getTime() - updatedDate.getTime()) / dayInMilliseconds);

  if (daysAgo <= 0) {
    return updatedAt.toLocaleTimeString(language === "th" ? "th-TH" : "en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: boardTimeZone,
    });
  }

  if (language === "th") return `${daysAgo} วันที่แล้ว`;
  return `${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`;
}

export function snapshotsMatch(
  left: { courts: Court[]; images: QrImage[] } | null,
  courts: Court[],
  images: QrImage[]
) {
  if (!left) return true;
  const imageIdentity = (image: QrImage) => `${image.path ?? "local"}:${image.name}:${image.url}`;
  return (
    left.courts.join("|") === courts.join("|") &&
    left.images.map(imageIdentity).join("|") === images.map(imageIdentity).join("|")
  );
}
