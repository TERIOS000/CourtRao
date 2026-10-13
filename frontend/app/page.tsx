"use client";

import Image from "next/image";
import {
  ChangeEvent,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  allowedCourts,
  allowedSlotTimes,
  allowedImageTypes,
  createDateRange,
  formatDateRange,
  formatUpdatedAt,
  maxImageSize,
  mergeBoardRecords,
  snapshotsMatch,
  type Court,
  type Day,
  type Language,
  type QrImage,
  type Slot,
  type SlotRecord,
  type SlotTime,
} from "@/lib/board";
import { getBoardService } from "@/lib/get-board-service";
import { NotificationBell } from "@/app/notification-bell";
import { useAccessibleDialog } from "@/app/use-accessible-dialog";

type SelectedSlot = {
  id: string;
  label: string;
  time: SlotTime;
};

type EditorSnapshot = {
  courts: Court[];
  images: QrImage[];
};

type Gallery = SelectedSlot & {
  images: QrImage[];
};

type Lightbox = {
  images: QrImage[];
  index: number;
};

type Confirmation = { kind: "discard" } | { kind: "clear" } | { kind: "image"; index: number };

type InstallPlatform = "ios" | "android" | "desktop";

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const copy = {
  en: {
    appName: "CourtRao",
    subtitle: "Courts reserved by our group",
    today: "Today",
    todayShortcut: "Go to today",
    language: "Language",
    edit: "Edit",
    editSlot: "Edit slot",
    courts: "Courts",
    qrImages: "Booking QR images (optional)",
    imageHelp: "JPEG, PNG, or WebP · maximum 5 MB each",
    selectedImages: "Selected QR images",
    viewImages: (count: number) => `View ${count} QR`,
    viewNamedImage: (name: string) => `View ${name} larger`,
    remove: "Remove",
    removeImage: (name: string) => `Remove ${name}?`,
    clearSlot: "Clear slot",
    clearConfirm: "Clear all courts and QR images from this slot?",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving…",
    confirm: "Confirm",
    close: "Close",
    closeEditor: "Close editor",
    closeGallery: "Close image gallery",
    closeViewer: "Close image viewer",
    discardConfirm: "Discard your unsaved changes?",
    saved: "Slot saved",
    cleared: "Slot cleared",
    updated: (time: string) => `Updated ${time}`,
    scheduleLabel: "Weekly tennis court schedule",
    editLabel: (label: string, time: string) => `Edit ${label} at ${time}`,
    galleryTitle: (label: string, time: string) => `${label} · ${time} QR images`,
    previousImage: "Previous image",
    nextImage: "Next image",
    imagePosition: (current: number, total: number) => `Image ${current} of ${total}`,
    largePreview: (name: string) => `Large preview of ${name}`,
    saveImage: "Save image",
    invalidType: (name: string) =>
      `${name} is not a JPEG, PNG, or WebP image.`,
    tooLarge: (name: string) => `${name} is larger than 5 MB.`,
    readError: "One or more images could not be read.",
    boardError: "The board could not load. Try again.",
    saveError: "Your changes could not be saved. Please try again.",
    offline: "You are offline. Reconnect before saving.",
    retry: "Try again",
    loading: "Loading…",
    noCourt: "No court recorded",
    installHelp: "Install CourtRao",
    installTitle: "Add CourtRao to your home screen",
    installIntro: "Keep the board one tap away without searching through LINE.",
    installIos: "Tap Share, then choose Add to Home Screen.",
    installAndroid: "Open your browser menu, then choose Install app or Add to Home screen.",
    installDesktop: "Use the install icon in your address bar, or choose Install app from the browser menu.",
  },
  th: {
    appName: "คอร์ทเรา",
    subtitle: "คอร์ทที่กลุ่มของเราจองไว้",
    today: "วันนี้",
    todayShortcut: "ไปที่วันนี้",
    language: "ภาษา",
    edit: "แก้ไข",
    editSlot: "แก้ไขช่วงเวลา",
    courts: "คอร์ท",
    qrImages: "รูป QR การจอง (ไม่บังคับ)",
    imageHelp: "JPEG, PNG หรือ WebP · ไม่เกิน 5 MB ต่อรูป",
    selectedImages: "รูป QR ที่เลือก",
    viewImages: (count: number) => `ดู QR ${count} รูป`,
    viewNamedImage: (name: string) => `ดู ${name} แบบขยาย`,
    remove: "ลบ",
    removeImage: (name: string) => `ลบ ${name} หรือไม่`,
    clearSlot: "ล้างช่วงเวลา",
    clearConfirm: "ล้างคอร์ทและรูป QR ทั้งหมดในช่วงเวลานี้หรือไม่",
    cancel: "ยกเลิก",
    save: "บันทึก",
    saving: "กำลังบันทึก…",
    confirm: "ยืนยัน",
    close: "ปิด",
    closeEditor: "ปิดหน้าต่างแก้ไข",
    closeGallery: "ปิดแกลเลอรีรูป",
    closeViewer: "ปิดรูปขยาย",
    discardConfirm: "ละทิ้งการเปลี่ยนแปลงที่ยังไม่ได้บันทึกหรือไม่",
    saved: "บันทึกช่วงเวลาแล้ว",
    cleared: "ล้างช่วงเวลาแล้ว",
    updated: (time: string) => `อัปเดต ${time}`,
    scheduleLabel: "ตารางคอร์ทเทนนิสประจำสัปดาห์",
    editLabel: (label: string, time: string) => `แก้ไข ${label} เวลา ${time}`,
    galleryTitle: (label: string, time: string) => `รูป QR ${label} · ${time}`,
    previousImage: "รูปก่อนหน้า",
    nextImage: "รูปถัดไป",
    imagePosition: (current: number, total: number) =>
      `รูปที่ ${current} จาก ${total}`,
    largePreview: (name: string) => `ภาพขยายของ ${name}`,
    saveImage: "บันทึกรูป",
    invalidType: (name: string) =>
      `${name} ไม่ใช่ไฟล์ JPEG, PNG หรือ WebP`,
    tooLarge: (name: string) => `${name} มีขนาดเกิน 5 MB`,
    readError: "ไม่สามารถอ่านรูปอย่างน้อยหนึ่งรูปได้",
    boardError: "ไม่สามารถโหลดตารางได้ กรุณาลองอีกครั้ง",
    saveError: "ไม่สามารถบันทึกการเปลี่ยนแปลงได้ กรุณาลองอีกครั้ง",
    offline: "คุณออฟไลน์อยู่ กรุณาเชื่อมต่อก่อนบันทึก",
    retry: "ลองอีกครั้ง",
    loading: "กำลังโหลด…",
    noCourt: "ยังไม่มีคอร์ท",
    installHelp: "ติดตั้ง CourtRao",
    installTitle: "เพิ่ม CourtRao ไปยังหน้าจอหลัก",
    installIntro: "เปิดตารางได้ในแตะเดียวโดยไม่ต้องค้นหาจากแชต LINE",
    installIos: "แตะปุ่มแชร์ แล้วเลือก เพิ่มไปยังหน้าจอโฮม",
    installAndroid: "เปิดเมนูเบราว์เซอร์ แล้วเลือก ติดตั้งแอป หรือ เพิ่มไปยังหน้าจอหลัก",
    installDesktop: "ใช้ไอคอนติดตั้งในแถบที่อยู่ หรือเลือก ติดตั้งแอป จากเมนูเบราว์เซอร์",
  },
} as const;

const subscribeToHydration = () => () => {};
const languageStorageKey = "tennis-board-language";
const languageChangeEvent = "tennis-board-language-change";

function getLanguageSnapshot(): Language {
  return window.localStorage.getItem(languageStorageKey) === "th" ? "th" : "en";
}

function subscribeToLanguage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(languageChangeEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(languageChangeEvent, onChange);
  };
}

function getInstallPlatform(): InstallPlatform {
  const isIos =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return isIos ? "ios" : /Android/i.test(navigator.userAgent) ? "android" : "desktop";
}

function getStandaloneSnapshot() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as NavigatorWithStandalone).standalone === true
  );
}

function subscribeToStandalone(onChange: () => void) {
  const standaloneQuery = window.matchMedia("(display-mode: standalone)");
  standaloneQuery.addEventListener("change", onChange);
  return () => standaloneQuery.removeEventListener("change", onChange);
}

function Dialog({
  active,
  className,
  labelledBy,
  onClose,
  children,
}: {
  active: boolean;
  className: string;
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  useAccessibleDialog(active, dialogRef, onClose);

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className={className}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
      >
        {children}
      </section>
    </div>
  );
}

export default function Home() {
  const isHydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const language = useSyncExternalStore<Language>(
    subscribeToLanguage,
    getLanguageSnapshot,
    (): Language => "en"
  );
  const isStandalone = useSyncExternalStore(subscribeToStandalone, getStandaloneSnapshot, () => false);
  const installPlatform = isHydrated ? getInstallPlatform() : "desktop";
  const t = copy[language];
  const baseDays = useMemo(
    () => (isHydrated ? createDateRange(language) : []),
    [isHydrated, language]
  );
  const [records, setRecords] = useState<SlotRecord[]>([]);
  const boardDays = useMemo(() => mergeBoardRecords(baseDays, records), [baseDays, records]);
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [selectedCourts, setSelectedCourts] = useState<Court[]>([]);
  const [qrImages, setQrImages] = useState<QrImage[]>([]);
  const [editorSnapshot, setEditorSnapshot] = useState<EditorSnapshot | null>(null);
  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [lightbox, setLightbox] = useState<Lightbox | null>(null);
  const [imageError, setImageError] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [boardError, setBoardError] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isInstallHelpOpen, setIsInstallHelpOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [highlightedSlot, setHighlightedSlot] = useState("");
  const todayRef = useRef<HTMLElement>(null);

  useEffect(() => {
    function saveInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    function clearInstallPrompt() {
      setInstallPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", saveInstallPrompt);
    window.addEventListener("appinstalled", clearInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", saveInstallPrompt);
      window.removeEventListener("appinstalled", clearInstallPrompt);
    };
  }, []);

  async function handleInstall() {
    if (!installPrompt) {
      setIsInstallHelpOpen(true);
      return;
    }

    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  useEffect(() => {
    if (baseDays.length === 0) return;
    return getBoardService().subscribe(baseDays.map((day) => day.id), {
      onData(nextRecords) {
        setRecords(nextRecords);
        setIsLoading(false);
      },
      onError() {
        setBoardError(true);
        setIsLoading(false);
      },
    });
  }, [baseDays, retryKey]);

  useEffect(() => {
    const updateConnection = () => setIsOffline(!navigator.onLine);
    updateConnection();
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  function changeLanguage() {
    const nextLanguage: Language = language === "en" ? "th" : "en";
    window.localStorage.setItem(languageStorageKey, nextLanguage);
    window.dispatchEvent(new Event(languageChangeEvent));
  }

  function openEditor(day: Day, slot: Slot) {
    const images = slot.qrImages ?? [];
    const courts = [...slot.courts];
    setSelectedSlot({ id: day.id, label: day.label, time: slot.time });
    setSelectedCourts(courts);
    setQrImages(images);
    setEditorSnapshot({ courts, images });
    setImageError("");
  }

  const finishEditor = useCallback(() => {
    setSelectedSlot(null);
    setSelectedCourts([]);
    setQrImages([]);
    setEditorSnapshot(null);
    setImageError("");
    setConfirmation(null);
  }, []);

  const closeEditor = useCallback(() => {
    if (confirmation) {
      setConfirmation(null);
      return;
    }
    if (snapshotsMatch(editorSnapshot, selectedCourts, qrImages)) finishEditor();
    else setConfirmation({ kind: "discard" });
  }, [confirmation, editorSnapshot, finishEditor, qrImages, selectedCourts]);

  function toggleCourt(court: Court) {
    setSelectedCourts((current) =>
      current.includes(court)
        ? current.filter((item) => item !== court)
        : [...current, court]
    );
  }

  async function saveSlot() {
    if (isSubmitting || !selectedSlot) return;
    if (isOffline) {
      setImageError(t.offline);
      return;
    }
    setIsSubmitting(true);
    setImageError("");
    try {
      await getBoardService().saveSlot(selectedSlot.id, selectedSlot.time, selectedCourts, qrImages);
      setNotice(t.saved);
      finishEditor();
    } catch {
      setImageError(t.saveError);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function clearSlot() {
    if (isSubmitting || !selectedSlot) return;
    if (isOffline) {
      setImageError(t.offline);
      return;
    }
    setIsSubmitting(true);
    setImageError("");
    try {
      await getBoardService().clearSlot(selectedSlot.id, selectedSlot.time);
      setNotice(t.cleared);
      finishEditor();
    } catch {
      setImageError(t.saveError);
    } finally {
      setIsSubmitting(false);
    }
  }

  function removeImage(index: number) {
    if (qrImages[index]) setConfirmation({ kind: "image", index });
  }

  function confirmationMessage(item: Confirmation) {
    if (item.kind === "discard") return t.discardConfirm;
    if (item.kind === "clear") return t.clearConfirm;
    return t.removeImage(qrImages[item.index]?.name ?? "");
  }

  function acceptConfirmation() {
    const item = confirmation;
    setConfirmation(null);
    if (!item) return;
    if (item.kind === "discard") finishEditor();
    else if (item.kind === "clear") void clearSlot();
    else setQrImages((current) => current.filter((_, itemIndex) => itemIndex !== item.index));
  }

  function handleQrChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    const invalidType = files.find((file) => !allowedImageTypes.includes(file.type));
    const oversizedFile = files.find((file) => file.size > maxImageSize);
    if (invalidType) {
      setImageError(t.invalidType(invalidType.name));
      event.target.value = "";
      return;
    }
    if (oversizedFile) {
      setImageError(t.tooLarge(oversizedFile.name));
      event.target.value = "";
      return;
    }

    Promise.all(
      files.map(
        (file) =>
          new Promise<QrImage>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () =>
              typeof reader.result === "string"
                ? resolve({ url: reader.result, name: file.name, file })
                : reject(new Error("Invalid image result"));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          })
      )
    )
      .then((newImages) => {
        setQrImages((current) => [...current, ...newImages]);
        setImageError("");
      })
      .catch(() => setImageError(t.readError));
    event.target.value = "";
  }

  const closeGallery = useCallback(() => setGallery(null), []);
  const closeLightbox = useCallback(() => setLightbox(null), []);

  function moveLightbox(direction: -1 | 1) {
    setLightbox((current) =>
      current
        ? {
            ...current,
            index: (current.index + direction + current.images.length) % current.images.length,
          }
        : null
    );
  }

  function handleViewerKeys(event: ReactKeyboardEvent) {
    if (event.key === "ArrowLeft") moveLightbox(-1);
    if (event.key === "ArrowRight") moveLightbox(1);
  }

  const currentImage = lightbox?.images[lightbox.index];

  function scrollToToday() {
    todayRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const showNotificationNotice = useCallback((message: string) => setNotice(message), []);
  const navigateToNotification = useCallback((dayId: string, time: SlotTime) => {
    const key = `${dayId}/${time}`;
    setHighlightedSlot(key);
    window.setTimeout(() => {
      document.querySelector<HTMLElement>(`[data-slot-key="${key}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
    window.setTimeout(() => setHighlightedSlot((current) => current === key ? "" : current), 2500);
  }, []);

  useEffect(() => {
    if (!isHydrated || baseDays.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const dayId = params.get("day");
    const time = params.get("time") as SlotTime | null;
    if (dayId && time && allowedSlotTimes.includes(time)) {
      const timeout = window.setTimeout(() => navigateToNotification(dayId, time), 0);
      return () => window.clearTimeout(timeout);
    }
  }, [baseDays.length, isHydrated, navigateToNotification]);

  function renderCourts(slot: Slot) {
    if (isLoading) return <span className="skeleton motion-safe:animate-pulse" aria-hidden="true" />;
    if (slot.courts.length === 0) {
      return (
        <span className="court-empty">
          <span aria-hidden="true">—</span>
          <span className="sr-only">{t.noCourt}</span>
        </span>
      );
    }
    return (
      <span className="court-list">
        {slot.courts.map((court) => (
          <span className="court-chip" key={court}>{court}</span>
        ))}
      </span>
    );
  }

  function renderSlotActions(day: Day, slot: Slot) {
    const images = slot.qrImages ?? [];

    return (
      <span className="slot-actions">
        {images.length > 0 && (
          <button
            className="qr-action"
            type="button"
            onClick={() =>
              setGallery({ id: day.id, label: day.label, time: slot.time, images })
            }
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13Zm2 11.7 3.4-3.4 2.3 2.3 3.8-4.6 2.5 3V6H6v11.2ZM9 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
            </svg>
            {t.viewImages(images.length)}
          </button>
        )}
        <button
          className="edit-button"
          type="button"
          onClick={() => openEditor(day, slot)}
          aria-label={t.editLabel(day.label, slot.time)}
          disabled={isLoading}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="m16.9 3.6 3.5 3.5a1.4 1.4 0 0 1 0 2L9.2 20.3 3 21l.7-6.2L14.9 3.6a1.4 1.4 0 0 1 2 0ZM6 15.8l-.3 2.5 2.5-.3 9.3-9.3-2.2-2.2L6 15.8Z" />
          </svg>
          <span className="btn-label">{t.edit}</span>
        </button>
      </span>
    );
  }

  return (
    <main className="board">
      <header className="board-header">
        <div>
          <h1>{t.appName}</h1>
          <p>{t.subtitle}</p>
        </div>
        <div className="header-actions">
          <NotificationBell language={language} onNavigate={navigateToNotification} onNotice={showNotificationNotice} />
        {!isStandalone && (
          <button
            className="install-help-button"
            type="button"
            onClick={handleInstall}
            aria-label={t.installHelp}
            title={t.installHelp}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
            </svg>
          </button>
        )}
        </div>
      </header>

      <nav className="board-toolbar" aria-label={t.todayShortcut}>
        <span>{formatDateRange(boardDays, language)}</span>
        <div className="toolbar-actions">
          <button
            type="button"
            className="language-switcher"
            aria-label={language === "en" ? "Switch to Thai" : "เปลี่ยนเป็นภาษาอังกฤษ"}
            onClick={changeLanguage}
          >
            <span className={language === "en" ? "on" : undefined}>EN</span>
            <span className={language === "th" ? "on" : undefined}>TH</span>
          </button>
          <button type="button" className="today-button" onClick={scrollToToday}>
            {t.todayShortcut}
          </button>
        </div>
      </nav>

      <section className="day-list" aria-label={t.scheduleLabel} aria-busy={isLoading}>
        {isLoading && <p className="sr-only" role="status">{t.loading}</p>}
        {boardError && (
          <p className="banner banner-error" role="alert">
            {t.boardError}
            <button type="button" onClick={() => {
              setIsLoading(true);
              setBoardError(false);
              setRetryKey((value) => value + 1);
            }}>
              {t.retry}
            </button>
          </p>
        )}
        {isOffline && <p className="banner" role="status">{t.offline}</p>}
        {baseDays.length === 0 &&
          Array.from({ length: 4 }, (_, index) => (
            <div className="day-card skeleton-card motion-safe:animate-pulse" key={index} aria-hidden="true" />
          ))}
        {boardDays.map((day) => (
          <article
            className={`day-card ${day.isToday ? "today" : ""}`}
            key={day.id}
            ref={day.isToday ? todayRef : undefined}
          >
            <h2>
              <span>{day.label}</span>
              {day.isToday && <span className="today-badge">{t.today}</span>}
            </h2>
            <div className="slot-list">
              {day.slots.map((slot) => (
                  <div
                    className={`slot-row ${highlightedSlot === `${day.id}/${slot.time}` ? "notification-highlight" : ""}`}
                    key={slot.time}
                    data-slot-key={`${day.id}/${slot.time}`}
                  >
                    <time>{slot.time}</time>
                    <div className="slot-main">
                      {renderCourts(slot)}
                      {slot.updatedAt && <small>{t.updated(formatUpdatedAt(slot.updatedAt, language))}</small>}
                    </div>
                    {renderSlotActions(day, slot)}
                  </div>
              ))}
            </div>
          </article>
        ))}
      </section>

      <footer className="board-footer">
        <p>© 2026 Terios.</p>
      </footer>

      {isInstallHelpOpen && (
        <Dialog
          active
          className="install-dialog"
          labelledBy="install-title"
          onClose={() => setIsInstallHelpOpen(false)}
        >
          <header className="editor-header">
            <div>
              <p>{t.installHelp}</p>
              <h2 id="install-title">{t.installTitle}</h2>
            </div>
            <button
              className="icon-button"
              type="button"
              onClick={() => setIsInstallHelpOpen(false)}
              aria-label={t.close}
            >
              ×
            </button>
          </header>
          <p className="install-intro">{t.installIntro}</p>
          <div className="install-step">
            <span aria-hidden="true">1</span>
            <p>
              {installPlatform === "ios"
                ? t.installIos
                : installPlatform === "android"
                  ? t.installAndroid
                  : t.installDesktop}
            </p>
          </div>
        </Dialog>
      )}

      {selectedSlot && (
        <Dialog
          active={!lightbox}
          className="slot-editor"
          labelledBy="editor-title"
          onClose={closeEditor}
        >
          <div className="editor-body">
            <header className="editor-header">
              <div>
                <p>{t.editSlot}</p>
                <h2 id="editor-title">{selectedSlot.label} · {selectedSlot.time}</h2>
              </div>
              <button className="icon-button" type="button" onClick={closeEditor} aria-label={t.closeEditor}>×</button>
            </header>
            <fieldset>
              <legend>{t.courts}</legend>
              <div className="court-options">
                {allowedCourts.map((court) => {
                  const isSelected = selectedCourts.includes(court);
                  return (
                    <button
                      className={`court-option ${isSelected ? "selected" : ""}`}
                      type="button"
                      key={court}
                      onClick={() => toggleCourt(court)}
                      aria-pressed={isSelected}
                    >
                      {court}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <div className="qr-field">
              <input id="qr-image" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleQrChange} />
              <label className="upload-button" htmlFor="qr-image">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2Z" />
                </svg>
                {t.qrImages}
              </label>
              <small>{t.imageHelp}</small>
              {imageError && <p className="field-error" role="alert">{imageError}</p>}
            </div>
            {qrImages.length > 0 && (
              <div className="qr-gallery" aria-label={t.selectedImages}>
                {qrImages.map((image, index) => (
                  <div className="qr-preview" key={`${image.name}-${index}`}>
                    <button
                      className="qr-thumbnail"
                      type="button"
                      onClick={() => setLightbox({ images: qrImages, index })}
                      aria-label={t.viewNamedImage(image.name)}
                    >
                      <Image src={image.url} alt="" width={180} height={180} unoptimized />
                    </button>
                    <p title={image.name}>{image.name}</p>
                    <button type="button" onClick={() => removeImage(index)}>{t.remove}</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {confirmation && (
            <div className="confirm-bar" role="alert">
              <p>{confirmationMessage(confirmation)}</p>
              <div>
                <button type="button" onClick={() => setConfirmation(null)} autoFocus>{t.cancel}</button>
                <button className="confirm-yes" type="button" onClick={acceptConfirmation}>{t.confirm}</button>
              </div>
            </div>
          )}
          <div className="editor-actions">
            <button className="danger-button" type="button" onClick={() => setConfirmation({ kind: "clear" })} disabled={isSubmitting}>{t.clearSlot}</button>
            <div>
              <button type="button" onClick={closeEditor}>{t.cancel}</button>
              <button className="save-button" type="button" onClick={saveSlot} disabled={isSubmitting} aria-busy={isSubmitting}>
                {isSubmitting ? t.saving : t.save}
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {gallery && (
        <Dialog
          active={!lightbox}
          className="gallery-dialog"
          labelledBy="gallery-title"
          onClose={closeGallery}
        >
          <header className="editor-header">
            <h2 id="gallery-title">{t.galleryTitle(gallery.label, gallery.time)}</h2>
            <button className="icon-button" type="button" onClick={closeGallery} aria-label={t.closeGallery}>×</button>
          </header>
          <div className="qr-gallery read-only-gallery">
            {gallery.images.map((image, index) => (
              <button
                className="gallery-card"
                type="button"
                key={`${image.name}-${index}`}
                onClick={() => setLightbox({ images: gallery.images, index })}
                aria-label={t.viewNamedImage(image.name)}
              >
                <Image src={image.url} alt="" width={240} height={240} unoptimized />
                <span>{image.name}</span>
              </button>
            ))}
          </div>
        </Dialog>
      )}

      {lightbox && currentImage && (
        <Dialog active className="image-viewer" labelledBy="image-viewer-title" onClose={closeLightbox}>
          <div onKeyDown={handleViewerKeys}>
            <header>
              <div>
                <h2 id="image-viewer-title">{currentImage.name}</h2>
                <p>{t.imagePosition(lightbox.index + 1, lightbox.images.length)}</p>
              </div>
              <button className="icon-button" type="button" onClick={closeLightbox} aria-label={t.closeViewer}>×</button>
            </header>
            <Image
              src={currentImage.url}
              alt={t.largePreview(currentImage.name)}
              width={1200}
              height={1200}
              unoptimized
            />
            <div className="viewer-actions">
              <button type="button" onClick={() => moveLightbox(-1)} disabled={lightbox.images.length < 2}>{t.previousImage}</button>
              <a href={currentImage.url} download={currentImage.name}>{t.saveImage}</a>
              <button type="button" onClick={() => moveLightbox(1)} disabled={lightbox.images.length < 2}>{t.nextImage}</button>
            </div>
          </div>
        </Dialog>
      )}

      <div className="toast" role="status" aria-live="polite">{notice}</div>
    </main>
  );
}
