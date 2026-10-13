import { RefObject, useEffect, useRef } from "react";

const focusableSelector =
  'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useAccessibleDialog(
  active: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void
) {
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!active) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    // Queried on every Tab so controls added after open (new QR previews, confirm bar) stay in the trap.
    const getFocusables = () =>
      Array.from(container?.querySelectorAll<HTMLElement>(focusableSelector) ?? []);
    (getFocusables()[0] ?? container)?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusables = getFocusables();
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement;
      // Focus can land on the container or on <body> (e.g. after a focused button unmounts).
      const isOutside = !container?.contains(current) || current === container;
      if (event.shiftKey && (isOutside || current === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (isOutside || current === last)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [active, containerRef]);
}
