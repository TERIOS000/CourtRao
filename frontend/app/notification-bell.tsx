"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccessibleDialog } from "@/app/use-accessible-dialog";
import type { Language, SlotTime } from "@/lib/board";
import { isFirebaseConfigured } from "@/lib/firebase-client";
import { getNotificationService, type PushState } from "@/lib/firebase-notification-service";
import { notificationText, type BoardNotification } from "@/lib/notification";

const labels = {
  en: {
    title: "Notifications", enable: "Enable push notifications", intro: "Get booking summaries at 9:00 AM and 4:30 PM on booking days.",
    empty: "No notifications from the last 7 days.", markAll: "Mark all as read", close: "Close notifications",
    unsupported: "Push notifications are not supported on this browser. You can still read history here.", iosInstall: "On iPhone or iPad, install CourtRao on your Home Screen before enabling push.",
    denied: "Push permission is blocked. Enable notifications in your browser settings to receive alerts.",
    enabled: "Push notifications are enabled.", error: "Notifications could not be updated. Try again.", local: "Push and shared history require Firebase configuration.",
  },
  th: {
    title: "การแจ้งเตือน", enable: "เปิดการแจ้งเตือน", intro: "รับสรุปการจองเวลา 09:00 และ 16:30 น. ในวันที่มีการจอง",
    empty: "ไม่มีการแจ้งเตือนใน 7 วันที่ผ่านมา", markAll: "อ่านทั้งหมดแล้ว", close: "ปิดการแจ้งเตือน",
    unsupported: "เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน แต่ยังดูประวัติได้ที่นี่", iosInstall: "บน iPhone หรือ iPad กรุณาเพิ่ม CourtRao ไปยังหน้าจอโฮมก่อนเปิดการแจ้งเตือน",
    denied: "เบราว์เซอร์บล็อกการแจ้งเตือน กรุณาเปิดสิทธิ์ในการตั้งค่าเบราว์เซอร์",
    enabled: "เปิดการแจ้งเตือนแล้ว", error: "ไม่สามารถอัปเดตการแจ้งเตือนได้ กรุณาลองใหม่", local: "ต้องตั้งค่า Firebase เพื่อใช้การแจ้งเตือนและประวัติร่วมกัน",
  },
} as const;

export function NotificationBell({ language, onNavigate, onNotice }: {
  language: Language;
  onNavigate: (dayId: string, time: SlotTime) => void;
  onNotice: (message: string) => void;
}) {
  const t = labels[language];
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<BoardNotification[]>([]);
  const [pushState, setPushState] = useState<PushState>("default");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const unread = useMemo(() => items.filter((item) => !item.read).length, [items]);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const service = getNotificationService();
    void service.pushState().then(setPushState);
    void service.refreshRegistration(language).catch(() => {});
    const openedNotification = new URLSearchParams(window.location.search).get("notification");
    if (openedNotification) void service.markRead([openedNotification]).catch(() => {});
    const stop = service.subscribe({ onData: setItems, onError: () => setError(t.error) });
    let stopMessage = () => {};
    void service.onForegroundMessage(() => onNotice(t.title)).then((unsubscribe) => { stopMessage = unsubscribe; });
    return () => { stop(); stopMessage(); };
  }, [language, onNotice, t.error, t.title]);

  const panelRef = useRef<HTMLElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useAccessibleDialog(open, panelRef, close);

  async function enable() {
    setBusy(true); setError("");
    try { setPushState(await getNotificationService().enablePush(language)); }
    catch { setError(t.error); }
    finally { setBusy(false); }
  }

  async function mark(ids: string[]) {
    try { await getNotificationService().markRead(ids); }
    catch { setError(t.error); }
  }

  function select(item: BoardNotification) {
    void mark([item.id]);
    setOpen(false);
    onNavigate(item.dayId, item.time);
  }

  return (
    <div className="notification-shell">
      <button className="header-icon-button notification-button" type="button" onClick={() => setOpen((value) => !value)} aria-label={t.title} title={t.title} aria-expanded={open}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22a2.4 2.4 0 0 0 2.3-1.7H9.7A2.4 2.4 0 0 0 12 22Zm7-5.7-1.6-2V9a5.4 5.4 0 0 0-4.2-5.3V3a1.2 1.2 0 1 0-2.4 0v.7A5.4 5.4 0 0 0 6.6 9v5.3l-1.6 2A1 1 0 0 0 5.8 18h12.4a1 1 0 0 0 .8-1.7Z" /></svg>
        {unread > 0 && <span className="notification-badge">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && <>
        <button className="notification-scrim" type="button" aria-label={t.close} onClick={close} />
        <section className="notification-panel" ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t.title}>
          <header><h2>{t.title}</h2><button type="button" className="icon-button" onClick={close} aria-label={t.close}>×</button></header>
          {!isFirebaseConfigured && <p className="notification-info">{t.local}</p>}
          {isFirebaseConfigured && pushState === "default" && <div className="notification-enable"><p>{t.intro}</p><button type="button" onClick={enable} disabled={busy}>{t.enable}</button></div>}
          {pushState === "enabled" && <p className="notification-state">{t.enabled}</p>}
          {pushState === "denied" && <p className="notification-info">{t.denied}</p>}
          {pushState === "unsupported" && <p className="notification-info">{/iPad|iPhone|iPod/.test(navigator.userAgent) ? t.iosInstall : t.unsupported}</p>}
          {error && <p className="field-error" role="alert">{error}</p>}
          <div className="notification-list">
            {items.length === 0 ? <p className="notification-empty">{t.empty}</p> : items.map((item) => {
              const text = notificationText(item, language);
              return <button type="button" className={`notification-item ${item.read ? "" : "unread"}`} key={item.id} onClick={() => select(item)}>
                <span className="notification-dot" aria-hidden="true" /><span><strong>{text.title}</strong><span>{text.body}</span><small>{item.createdAt.toLocaleString(language === "th" ? "th-TH" : "en-GB")}</small></span>
              </button>;
            })}
          </div>
          {unread > 0 && <footer><button type="button" onClick={() => void mark(items.filter((item) => !item.read).map((item) => item.id))}>{t.markAll}</button></footer>}
        </section>
      </>}
    </div>
  );
}
