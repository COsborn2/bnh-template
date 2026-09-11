"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";

// Auto-dismiss windows. Errors stay until the user acknowledges them; success
// and info clear on their own.
export const TOAST_DURATION_DEFAULT = 5000;
export const TOAST_DURATION_ERROR = 0;

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
  action?: ToastAction;
  /** Milliseconds until auto-dismiss; 0 keeps the toast until dismissed. */
  duration: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (
    message: string,
    type?: Toast["type"],
    action?: ToastAction,
  ) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, type = "info", action) => {
    const id = crypto.randomUUID();
    const duration =
      type === "error" ? TOAST_DURATION_ERROR : TOAST_DURATION_DEFAULT;
    // Dismissal is owned by the rendered ToastItem (so it can pause on hover
    // and stops with the toast), not by a timer in the store.
    set((s) => ({
      toasts: [...s.toasts, { id, message, type, action, duration }],
    }));
  },
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function toast(
  message: string,
  type?: Toast["type"],
  action?: ToastAction,
) {
  useToastStore.getState().addToast(message, type, action);
}

const TIMER_SIZE = 16;
const TIMER_STROKE = 2;
const TIMER_RADIUS = (TIMER_SIZE - TIMER_STROKE) / 2;
const TIMER_CIRCUMFERENCE = 2 * Math.PI * TIMER_RADIUS;

/** Countdown ring; `progress` is the remaining fraction (1 = full). */
function TimerRing({
  type,
  progress,
}: {
  type: Toast["type"];
  progress: number;
}) {
  const color =
    type === "success"
      ? "var(--color-accent-green)"
      : type === "error"
        ? "var(--color-accent-rose)"
        : "var(--color-accent-blue)";

  return (
    <svg
      width={TIMER_SIZE}
      height={TIMER_SIZE}
      className="flex-shrink-0 -rotate-90"
      aria-hidden="true"
    >
      <circle
        cx={TIMER_SIZE / 2}
        cy={TIMER_SIZE / 2}
        r={TIMER_RADIUS}
        fill="none"
        stroke={color}
        strokeOpacity={0.25}
        strokeWidth={TIMER_STROKE}
      />
      <circle
        cx={TIMER_SIZE / 2}
        cy={TIMER_SIZE / 2}
        r={TIMER_RADIUS}
        fill="none"
        stroke={color}
        strokeWidth={TIMER_STROKE}
        strokeLinecap="round"
        strokeDasharray={TIMER_CIRCUMFERENCE}
        strokeDashoffset={TIMER_CIRCUMFERENCE * (1 - progress)}
        style={{ transition: "stroke-dashoffset 0.1s linear" }}
      />
    </svg>
  );
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    // Toasts are global feedback and must never hide behind other chrome: per
    // the z-index contract in globals.css modals sit at 100 (200 nested) and
    // confirmations at 300, so clear them all. The column itself is
    // click-through; each toast opts back in.
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-6 right-6 z-[400] flex flex-col items-end gap-2"
    >
      {toasts.map((t, i) => (
        <ToastItem key={t.id} toast={t} index={i} />
      ))}
    </div>
  );
}

function ToastItem({ toast: t, index }: { toast: Toast; index: number }) {
  const removeToast = useToastStore((s) => s.removeToast);
  const [remaining, setRemaining] = useState(t.duration);
  const [hovered, setHovered] = useState(false);

  // Tick the timer every 50ms while not hovered. Reseats on hover changes so
  // a snapshot of `remaining` is taken each time the pause/resume transitions.
  useEffect(() => {
    if (hovered || !t.duration) return;
    const start = Date.now();
    const base = remaining;
    const id = setInterval(() => {
      const next = Math.max(0, base - (Date.now() - start));
      setRemaining(next);
      if (next <= 0) {
        clearInterval(id);
        removeToast(t.id);
      }
    }, 50);
    return () => clearInterval(id);
    // `remaining` is intentionally omitted — it's snapshotted via `base`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hovered, t.duration, t.id, removeToast]);

  const progress = t.duration > 0 ? remaining / t.duration : 1;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="pointer-events-auto animate-slide-in-right max-w-md rounded-lg border border-border bg-bg-raised px-4 py-3 shadow-2xl"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-center gap-3">
        <TimerRing type={t.type} progress={progress} />
        {/* Wrap instead of truncating — error copy must stay readable in
            full (max-w-md bounds the line length). */}
        <span className="min-w-0 text-sm [overflow-wrap:anywhere]">
          {t.message}
        </span>
        {t.action && (
          <button
            type="button"
            onClick={() => {
              t.action!.onClick();
              removeToast(t.id);
            }}
            className="ml-1 shrink-0 text-sm font-medium text-accent-blue underline underline-offset-2 hover:text-primary"
          >
            {t.action.label}
          </button>
        )}
        <button
          type="button"
          onClick={() => removeToast(t.id)}
          aria-label="Dismiss"
          className="ml-2 shrink-0 text-text-faint hover:text-text"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
