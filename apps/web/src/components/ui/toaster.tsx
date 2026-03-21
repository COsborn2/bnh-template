"use client";

import { create } from "zustand";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";

const TOAST_DURATION = 10000;

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
  action?: ToastAction;
}

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, type?: Toast["type"], action?: ToastAction) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, type = "info", action) => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, message, type, action }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, TOAST_DURATION);
  },
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function toast(message: string, type?: Toast["type"], action?: ToastAction) {
  useToastStore.getState().addToast(message, type, action);
}

const TIMER_SIZE = 16;
const TIMER_STROKE = 2;
const TIMER_RADIUS = (TIMER_SIZE - TIMER_STROKE) / 2;
const TIMER_CIRCUMFERENCE = 2 * Math.PI * TIMER_RADIUS;

function TimerRing({ type }: { type: Toast["type"] }) {
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
        strokeDashoffset={0}
        style={{
          animation: `toast-timer ${TOAST_DURATION}ms linear forwards`,
        }}
      />
    </svg>
  );
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes toast-timer {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: ${TIMER_CIRCUMFERENCE}; }
        }
      `}</style>
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map((t, i) => (
          <div
            key={t.id}
            className="animate-slide-in-right rounded-lg border border-border bg-bg-raised px-4 py-3 shadow-2xl"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="flex items-center gap-3">
              <TimerRing type={t.type} />
              <span className="text-sm">{t.message}</span>
              {t.action && (
                <button
                  onClick={() => {
                    t.action!.onClick();
                    removeToast(t.id);
                  }}
                  className="ml-1 text-sm font-medium text-accent-blue hover:text-primary underline underline-offset-2"
                >
                  {t.action.label}
                </button>
              )}
              <button
                onClick={() => removeToast(t.id)}
                className="ml-2 text-text-faint hover:text-text"
              >
                <FontAwesomeIcon icon={faXmark} className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
