"use client";

import { useEffect } from "react";
import { useThemeStore } from "@/stores/theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const preference = useThemeStore((s) => s.preference);
  const resolved = useThemeStore((s) => s.resolved);
  const setPreference = useThemeStore((s) => s.setPreference);
  const hydrate = useThemeStore((s) => s.hydrate);
  const hydrated = useThemeStore((s) => s._hydrated);

  // Hydrate from localStorage on mount (client-only)
  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  // Apply theme class to <html>
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolved);
  }, [resolved]);

  // Listen for system preference changes when preference is "system"
  useEffect(() => {
    if (preference !== "system") return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setPreference("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [preference, setPreference]);

  return <>{children}</>;
}
