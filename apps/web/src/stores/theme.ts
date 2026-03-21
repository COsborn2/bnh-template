import { create } from "zustand";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "theme-preference";

function getStoredPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // localStorage may throw in some SSR/restricted contexts
  }
  return "system";
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolveTheme(pref: ThemePreference): ResolvedTheme {
  return pref === "system" ? getSystemTheme() : pref;
}

interface ThemeState {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  _hydrated: boolean;
  setPreference: (pref: ThemePreference) => void;
  hydrate: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  // SSR-safe defaults — real values loaded in hydrate()
  preference: "system",
  resolved: "dark",
  _hydrated: false,
  setPreference: (pref) => {
    localStorage.setItem(STORAGE_KEY, pref);
    const resolved = resolveTheme(pref);
    set({ preference: pref, resolved });
  },
  hydrate: () => {
    const preference = getStoredPreference();
    const resolved = resolveTheme(preference);
    set({ preference, resolved, _hydrated: true });
  },
}));
