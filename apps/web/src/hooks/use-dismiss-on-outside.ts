"use client";

import { useEffect, useRef, type RefObject } from "react";

/** Dismisses a menu or popover on an outside `mousedown` or Escape while
 *  `active`. A click inside `ref` — or inside `opts.anchorRef`, the trigger —
 *  is left to the caller so the trigger can toggle instead of closing and
 *  reopening.
 *
 *  Refs and the callback are read through a latest-value ref, so the document
 *  listeners are bound once per `active` flip rather than on every render
 *  (callers pass inline arrows). */
export function useDismissOnOutside(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onDismiss: () => void,
  opts: { anchorRef?: RefObject<HTMLElement | null> } = {},
): void {
  const latest = useRef({ ref, anchorRef: opts.anchorRef, onDismiss });
  useEffect(() => {
    latest.current = { ref, anchorRef: opts.anchorRef, onDismiss };
  });
  useEffect(() => {
    if (!active) return;
    function onDocClick(e: MouseEvent) {
      const { ref, anchorRef, onDismiss } = latest.current;
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (anchorRef?.current?.contains(target)) return;
      onDismiss();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") latest.current.onDismiss();
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [active]);
}
