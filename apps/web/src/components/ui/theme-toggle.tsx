"use client";

import { ThemeToggle as SharedThemeToggle } from "@cosborn2/ui/theme-toggle";
import "@cosborn2/ui/theme-toggle.css";
import { useThemeStore } from "@/stores/theme";

export function ThemeToggle() {
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);
  return <SharedThemeToggle value={preference} onChange={setPreference} />;
}
