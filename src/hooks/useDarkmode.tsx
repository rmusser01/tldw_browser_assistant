import React from "react";
import { create } from "zustand";
import { useSetting } from "@/hooks/useSetting";
import { THEME_SETTING } from "@/services/settings/ui-settings";

type DarkModeState = {
  mode: "system" | "dark" | "light";
  setMode: (mode: "system" | "dark" | "light") => void;
};

export const useDarkModeStore = create<DarkModeState>((set) => ({
  mode: "system",
  setMode: (mode) => set({ mode }),
}));

export const useDarkMode = () => {
  const { mode, setMode } = useDarkModeStore();
  const [themePreference, setThemePreference] = useSetting(THEME_SETTING);

  const getSystemTheme = React.useCallback(() => {
    const darkModeMediaQuery = window.matchMedia(
      "(prefers-color-scheme: dark)"
    );
    const isDarkMode = darkModeMediaQuery.matches;
    return isDarkMode ? "dark" : "light";
  }, []);

  const applyTheme = React.useCallback(
    (nextMode: "dark" | "light") => {
      if (typeof document === "undefined") return;
      document.documentElement.classList.remove("dark", "light");
      document.documentElement.classList.add(nextMode);
      setMode(nextMode);
    },
    [setMode]
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const resolved =
      themePreference === "system" ? getSystemTheme() : themePreference;
    applyTheme(resolved);
  }, [applyTheme, getSystemTheme, themePreference]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (themePreference !== "system") return;
    const darkModeMediaQuery = window.matchMedia(
      "(prefers-color-scheme: dark)"
    );
    const handleDarkModeChange = (e: MediaQueryListEvent) => {
      applyTheme(e.matches ? "dark" : "light");
    };
    darkModeMediaQuery.addEventListener("change", handleDarkModeChange);
    return () =>
      darkModeMediaQuery.removeEventListener("change", handleDarkModeChange);
  }, [applyTheme, themePreference]);

  const toggleDarkMode = () => {
    const newMode = mode === "dark" ? "light" : "dark";
    applyTheme(newMode);
    void setThemePreference(newMode);
  };

  return { mode, toggleDarkMode };
};
