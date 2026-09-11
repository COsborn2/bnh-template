"use client";

import { useEffect, useRef, type HTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  DOCUMENT_MODAL_OPEN_CLASS,
  useDocumentClass,
} from "@/hooks/use-document-class";

let scrollLockCount = 0;
let savedScrollY = 0;
let savedHtmlOverflow = "";
let savedBodyOverflow = "";
let savedBodyPosition = "";
let savedBodyTop = "";
let savedBodyLeft = "";
let savedBodyRight = "";
let savedBodyWidth = "";

function lockDocumentScroll() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  scrollLockCount += 1;
  if (scrollLockCount > 1) return;

  const html = document.documentElement;
  const body = document.body;

  savedScrollY = window.scrollY;
  savedHtmlOverflow = html.style.overflow;
  savedBodyOverflow = body.style.overflow;
  savedBodyPosition = body.style.position;
  savedBodyTop = body.style.top;
  savedBodyLeft = body.style.left;
  savedBodyRight = body.style.right;
  savedBodyWidth = body.style.width;

  html.style.overflow = "hidden";
  body.style.overflow = "hidden";
  body.style.position = "fixed";
  body.style.top = `-${savedScrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
}

function unlockDocumentScroll() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount > 0) return;

  const html = document.documentElement;
  const body = document.body;

  html.style.overflow = savedHtmlOverflow;
  body.style.overflow = savedBodyOverflow;
  body.style.position = savedBodyPosition;
  body.style.top = savedBodyTop;
  body.style.left = savedBodyLeft;
  body.style.right = savedBodyRight;
  body.style.width = savedBodyWidth;
  window.scrollTo(0, savedScrollY);
}

type EscapeHandler = (e: KeyboardEvent) => void;

/** Mounted overlays, bottom → top. Each overlay binds its own document keydown
 *  listener, so without this a ConfirmDialog opened over another Modal would
 *  close both on one Escape: only the top-most entry handles the key, and a
 *  persistent overlay on top (no handler) swallows it rather than closing the
 *  one beneath. Entries are per-overlay refs rather than the handlers
 *  themselves so a lower modal re-rendering with a new inline `onEscape`
 *  keeps its place in the stack. */
const overlayStack: Array<{ current: EscapeHandler | undefined }> = [];

interface ModalOverlayProps extends HTMLAttributes<HTMLDivElement> {
  /** Document-level Escape handler while mounted; omit to leave Escape
   *  unhandled (persistent modals). */
  onEscape?: EscapeHandler;
  children: ReactNode;
}

/**
 * The overlay layer shared by every full-screen modal: body portal, refcounted
 * document scroll lock + `modal-open` document class (stacked modals unlock
 * only when the last one closes), and optional Escape handling. The backdrop
 * div is styled entirely through the usual div props; the card inside is the
 * caller's markup — `Modal` layers its standard card on this, bespoke dialogs
 * bring their own.
 */
export function ModalOverlay({
  onEscape,
  children,
  ...overlayProps
}: ModalOverlayProps) {
  useDocumentClass(DOCUMENT_MODAL_OPEN_CLASS);

  useEffect(() => {
    lockDocumentScroll();
    return unlockDocumentScroll;
  }, []);

  const onEscapeRef = useRef(onEscape);
  useEffect(() => {
    onEscapeRef.current = onEscape;
  });

  useEffect(() => {
    const entry = onEscapeRef;
    overlayStack.push(entry);
    function handleKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (overlayStack[overlayStack.length - 1] !== entry) return;
      entry.current?.(e);
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      const index = overlayStack.lastIndexOf(entry);
      if (index !== -1) overlayStack.splice(index, 1);
    };
  }, []);

  if (typeof document === "undefined") return null;
  return createPortal(<div {...overlayProps}>{children}</div>, document.body);
}
