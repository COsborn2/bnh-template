"use client";

import { useEffect, useRef, useState } from "react";
import { Toast as SharedToast, ToastViewport } from "@cosborn2/ui/toast";
import "@cosborn2/ui/toast.css";
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
  duration: number;
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
    const duration =
      type === "error" ? TOAST_DURATION_ERROR : TOAST_DURATION_DEFAULT;
    set((s) => ({ toasts: [...s.toasts, { id, message, type, action, duration }] }));
  },
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function toast(message: string, type?: Toast["type"], action?: ToastAction) {
  useToastStore.getState().addToast(message, type, action);
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <ToastViewport
      announcements={{
        polite: toasts.filter((notification) => notification.type !== "error").map((notification) => <span key={notification.id}>{notification.message}</span>),
        assertive: toasts.filter((notification) => notification.type === "error").map((notification) => <span key={notification.id}>{notification.message}</span>),
      }}
    >
      {toasts.map((notification) => <TimedToast key={notification.id} toast={notification} />)}
    </ToastViewport>
  );
}

function TimedToast({ toast: notification }: { toast: Toast }) {
  const removeToast = useToastStore((s) => s.removeToast);
  const remainingTime = useRef(notification.duration);
  const [remaining, setRemaining] = useState(notification.duration);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (hovered || focused || !notification.duration) return;
    const start = performance.now();
    const initial = remainingTime.current;
    const tick = setInterval(() => {
      const next = Math.max(0, initial - (performance.now() - start));
      remainingTime.current = next;
      setRemaining(next);
      if (next === 0) {
        clearInterval(tick);
        removeToast(notification.id);
      }
    }, 50);
    return () => {
      clearInterval(tick);
      remainingTime.current = Math.max(0, initial - (performance.now() - start));
    };
  }, [hovered, focused, notification.duration, notification.id, removeToast]);

  return (
    <SharedToast
      message={notification.message}
      variant={notification.type}
      announce="off"
      progress={notification.duration > 0 ? remaining / notification.duration : undefined}
      onDismiss={() => removeToast(notification.id)}
      action={notification.action && {
        label: notification.action.label,
        onClick: () => {
          notification.action!.onClick();
          removeToast(notification.id);
        },
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    />
  );
}
