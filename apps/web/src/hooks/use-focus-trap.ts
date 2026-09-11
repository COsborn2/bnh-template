"use client";

import { useCallback, type KeyboardEvent, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Keyboard focus containment for overlay dialogs: returns an onKeyDown
 * handler that wraps Tab / Shift+Tab within the container's focusable
 * descendants so focus never escapes into the dimmed page behind.
 */
export function useFocusTrap(containerRef: RefObject<HTMLElement | null>) {
  return useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      const container = containerRef.current;
      if (e.key !== "Tab" || !container) return;
      const focusables =
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      // The container itself may hold focus (dialogs focus it on mount via
      // tabIndex={-1}); Shift+Tab from there must wrap to the last focusable
      // too, or it escapes backwards into the page behind the overlay.
      if (
        e.shiftKey &&
        (document.activeElement === container ||
          document.activeElement === first)
      ) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [containerRef],
  );
}
