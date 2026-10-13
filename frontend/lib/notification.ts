import type { Court, Language, SlotTime } from "@/lib/board";

export type BoardNotification = {
  id: string;
  type: "booking-reminder";
  dayId: string;
  time: SlotTime;
  createdAt: Date;
  expiresAt: Date;
  read: boolean;
  reminderSlots: { time: SlotTime; courts: Court[] }[];
};

export function notificationText(notification: BoardNotification, language: Language) {
  const date = new Intl.DateTimeFormat(language === "th" ? "th-TH" : "en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${notification.dayId}T12:00:00Z`));
  const combinedReminder = notification.reminderSlots
    .map((slot) => `${slot.time} ${slot.courts.join(", ")}`)
    .join("\n");

  if (language === "th") {
    return { title: "เตือนการจองคอร์ท", body: `${date}\n${combinedReminder}` };
  }

  return { title: "Court booking reminder", body: `${date}\n${combinedReminder}` };
}

export function isActiveNotification(expiresAt: Date, now = new Date()) {
  return expiresAt.getTime() > now.getTime();
}
