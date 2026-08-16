"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export const COLOR_THEMES = [
  { value: "urban-slate", label: "Urban Slate", swatches: ["#5b6b85", "#8d7a6e", "#f6f6f7"] },
  { value: "ink-wash", label: "Ink Wash", swatches: ["#3a3a3a", "#7d7d7d", "#fcfcfb"] },
  { value: "neutral-elegance", label: "Neutral Elegance", swatches: ["#8a6c53", "#e0b088", "#fffaf4"] },
  { value: "driftwood-pearl", label: "Driftwood Pearl Morning", swatches: ["#a06456", "#5c7688", "#faf7f5"] },
  { value: "amber-walnut", label: "Amber Walnut Morning", swatches: ["#a85a30", "#c8906d", "#fdfaf7"] },
] as const;

export type ColorThemeValue = (typeof COLOR_THEMES)[number]["value"];

const DEFAULT_COLOR_THEME: ColorThemeValue = "urban-slate";
const STORAGE_KEY = "hostly-color-theme";

interface ColorThemeContextValue {
  colorTheme: ColorThemeValue;
  setColorTheme: (value: ColorThemeValue) => void;
}

const ColorThemeContext = createContext<ColorThemeContextValue | null>(null);

/**
 * A second, independent theme dimension from the light/dark
 * ThemeProvider (theme-provider.tsx) — deliberately NOT built on
 * next-themes' own <ThemeProvider> a second time. next-themes detects
 * an ancestor ThemeProvider via a shared module-level React context
 * and silently renders a nested one as a no-op passthrough (confirmed
 * in its own source: `useContext(x) ? <Fragment>children</Fragment> :
 * <RealProvider>`) — nesting it inside the light/dark provider meant
 * this provider's own attribute/storageKey/context were never applied
 * at all, so picking a color theme silently did nothing. This is a
 * small hand-rolled equivalent instead: its own React context,
 * localStorage key, and direct `data-color-theme` attribute write on
 * <html>, with no shared state with the light/dark provider.
 */
export default function ColorThemeProvider({ children }: { children: ReactNode }) {
  const [colorTheme, setColorThemeState] = useState<ColorThemeValue>(DEFAULT_COLOR_THEME);

  useEffect(() => {
    let stored: string | null = null;

    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // Storage unavailable — falls through to the default theme.
    }

    const isValid = COLOR_THEMES.some((t) => t.value === stored);
    const initial = isValid ? (stored as ColorThemeValue) : DEFAULT_COLOR_THEME;

    setColorThemeState(initial);
    document.documentElement.setAttribute("data-color-theme", initial);
  }, []);

  const setColorTheme = useCallback((value: ColorThemeValue) => {
    setColorThemeState(value);
    document.documentElement.setAttribute("data-color-theme", value);

    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Non-fatal — the choice just won't persist across reloads.
    }
  }, []);

  return (
    <ColorThemeContext.Provider value={{ colorTheme, setColorTheme }}>
      {children}
    </ColorThemeContext.Provider>
  );
}

export function useColorTheme(): ColorThemeContextValue {
  const ctx = useContext(ColorThemeContext);

  if (!ctx) {
    throw new Error("useColorTheme() must be used within a ColorThemeProvider");
  }

  return ctx;
}
