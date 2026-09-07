"use client";

import {
  useEffect,
  useId,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { useFocusTrap } from "@/hooks/use-focus-trap";

interface ModalProps {
  onClose: () => void;
  children: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  headerActions?: ReactNode;
  /** Accessible name when there is no `title`. */
  ariaLabel?: string;
  maxWidth?: string;
  footer?: ReactNode;
  /** No close button, and neither backdrop click nor Escape dismiss. */
  persistent?: boolean;
  /** Overlay stacking level; see the z-index contract in globals.css
   *  (modals 100, confirmations 300, toasts 400). */
  zIndex?: number;
  bodyClassName?: string;
}

/**
 * Standard dialog: `ModalOverlay` (body portal, scroll lock, Escape) around a
 * `ModalCard`. Backdrop click and Escape call `onClose` unless `persistent`.
 */
export function Modal({
  zIndex,
  persistent = false,
  ...cardProps
}: ModalProps) {
  // Published as --modal-z so .modal-overlay can stack per the contract.
  const overlayStyle = {
    "--modal-z": zIndex ?? 100,
  } as CSSProperties;

  return (
    <ModalOverlay
      className="modal-overlay"
      onClick={persistent ? undefined : cardProps.onClose}
      onEscape={persistent ? undefined : cardProps.onClose}
      style={overlayStyle}
    >
      <ModalCard persistent={persistent} {...cardProps} />
    </ModalOverlay>
  );
}

type ModalCardProps = Omit<ModalProps, "zIndex">;

/**
 * The dialog card itself — `role="dialog"`, labelled by its title, focus
 * moved inside on open and trapped while open. `Modal` wraps it in the
 * overlay; it is exported on its own so it can render without a portal
 * (tests, bespoke hosts).
 */
export function ModalCard({
  onClose,
  children,
  title,
  subtitle,
  headerActions,
  ariaLabel,
  maxWidth = "max-w-[640px]",
  footer,
  persistent = false,
  bodyClassName = "px-[24px] pt-[16px] pb-[22px]",
}: ModalCardProps) {
  const titleId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const trapFocus = useFocusTrap(cardRef);

  // Move focus into the dialog on open so keyboard users start inside it
  // (the trap only wraps Tab once focus is within the card) — unless a child
  // already claimed it via autoFocus. On close, hand focus back to whatever
  // opened the dialog so the user isn't dropped at <body>, but never steal it
  // from something they have since clicked into.
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (!card.contains(document.activeElement)) {
      card.focus({ preventScroll: true });
    }
    return () => {
      const active = document.activeElement;
      const orphaned =
        !active || active === document.body || card.contains(active);
      if (orphaned && opener && document.contains(opener)) {
        opener.focus({ preventScroll: true });
      }
    };
  }, []);

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      aria-label={!title ? ariaLabel : undefined}
      tabIndex={-1}
      onKeyDown={trapFocus}
      className={`animate-fade-up relative w-full ${maxWidth} max-h-[calc(100vh-40px)] min-h-0 flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-bg-raised shadow-2xl outline-none`}
      onClick={(e) => e.stopPropagation()}
    >
      {!persistent && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-[14px] top-[14px] z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border-0 bg-transparent text-[18px] leading-none text-text-muted transition-colors hover:bg-bg-hover hover:text-text"
        >
          ×
        </button>
      )}

      {headerActions && (
        <div className="flex shrink-0 items-center gap-[10px] border-b border-border px-[22px] py-[16px] pr-[52px]">
          <div className="min-w-0 flex-1">{headerActions}</div>
        </div>
      )}

      {title && (
        <div
          className={`shrink-0 px-[24px] pt-[20px] pb-1 ${headerActions ? "" : "pr-[52px]"}`}
        >
          <h2
            id={titleId}
            className="m-0 text-[17px] font-semibold leading-snug tracking-[-0.01em] text-text"
          >
            {title}
          </h2>
          {subtitle && (
            <p className="m-0 mt-1 text-[12px] text-text-muted">{subtitle}</p>
          )}
        </div>
      )}

      <div
        className={`min-h-0 flex-1 overflow-y-auto ${bodyClassName}`}
        style={{
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain",
        }}
      >
        {children}
      </div>

      {footer && (
        <div className="shrink-0 border-t border-border bg-bg-hover px-[22px] py-[13px]">
          {footer}
        </div>
      )}
    </div>
  );
}
