"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { COLOR_THEMES, useColorTheme } from "./color-theme-provider";

/**
 * A grid of swatch buttons for the light-mode color theme (see
 * color-theme-provider.tsx) — separate from the sidebar's Light/Dark/
 * System toggle (theme-toggle.tsx), which controls a different thing
 * entirely. Renders a stable placeholder until mounted, same
 * hydration-safety reasoning as ThemeToggle.
 */
export default function ColorThemeToggle() {
  const { colorTheme, setColorTheme } = useColorTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {COLOR_THEMES.map((t) => (
          <div key={t.value} className="h-20 animate-pulse rounded-xl border border-border bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {COLOR_THEMES.map((t) => {
        const active = colorTheme === t.value;

        return (
          <button
            key={t.value}
            type="button"
            onClick={() => setColorTheme(t.value)}
            aria-pressed={active}
            className={`relative flex flex-col gap-3 rounded-xl border p-3 text-left transition ${
              active
                ? "border-primary ring-2 ring-primary/30"
                : "border-border hover:border-primary/40"
            }`}
          >
            {active && (
              <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check size={12} />
              </span>
            )}

            <div className="flex overflow-hidden rounded-lg border border-border/60">
              {t.swatches.map((color) => (
                <span key={color} className="h-8 flex-1" style={{ backgroundColor: color }} />
              ))}
            </div>

            <span className="text-xs font-medium text-foreground">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
