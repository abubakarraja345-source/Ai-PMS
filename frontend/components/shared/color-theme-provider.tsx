"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

export const COLOR_THEMES = [
  { value: "urban-slate", label: "Urban Slate", swatches: ["#5b6b85", "#8d7a6e", "#f6f6f7"] },
  { value: "ink-wash", label: "Ink Wash", swatches: ["#3a3a3a", "#7d7d7d", "#fcfcfb"] },
  { value: "neutral-elegance", label: "Neutral Elegance", swatches: ["#8a6c53", "#e0b088", "#fffaf4"] },
  { value: "driftwood-pearl", label: "Driftwood Pearl Morning", swatches: ["#a06456", "#5c7688", "#faf7f5"] },
  { value: "amber-walnut", label: "Amber Walnut Morning", swatches: ["#a85a30", "#c8906d", "#fdfaf7"] },
] as const;

export type ColorThemeValue = (typeof COLOR_THEMES)[number]["value"];

/**
 * A second, independent next-themes instance — different
 * attribute/storageKey from the light/dark ThemeProvider
 * (theme-provider.tsx), so the two never collide. This one only ever
 * takes effect in light mode (see globals.css's `:not(.dark)` guard
 * on every [data-color-theme] block) — dark mode always uses the
 * single fixed indigo/violet-on-navy palette regardless of which
 * color theme is selected, so `enableSystem` is irrelevant here and
 * left off.
 */
export default function ColorThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-color-theme"
      storageKey="hostly-color-theme"
      defaultTheme="urban-slate"
      themes={COLOR_THEMES.map((t) => t.value)}
      enableSystem={false}
    >
      {children}
    </NextThemesProvider>
  );
}
