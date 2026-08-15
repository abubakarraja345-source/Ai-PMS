"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

/**
 * Light/Dark/System toggle. Renders a stable placeholder until
 * mounted — `next-themes`' resolved value isn't known on the server,
 * so rendering the real state before hydration would mismatch.
 *
 * `variant` picks colors for the surface this is placed ON — "light"/
 * "dark" both assume the app's own dark sidebar (both were designed
 * before the "surface" variant existed, when the toggle only ever
 * lived there); "surface" is for a plain light card background, e.g.
 * the Settings page — which still uses this app's original hardcoded
 * slate palette rather than the design-token system, so this variant
 * intentionally matches that instead of the token-based sidebar
 * colors.
 */
export default function ThemeToggle({
  variant = "light",
}: {
  variant?: "light" | "dark" | "surface";
}) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const trackClasses =
    variant === "surface"
      ? "border-slate-200 bg-slate-50"
      : variant === "dark"
      ? "border-white/10 bg-white/5"
      : "border-sidebar-border bg-white/5";

  const activeClasses =
    variant === "surface" ? "bg-slate-900 text-white" : "bg-sidebar-primary text-white";

  const inactiveClasses =
    variant === "surface"
      ? "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      : "text-slate-400 hover:bg-white/10 hover:text-white";

  if (!mounted) {
    return <div className={`h-9 w-full animate-pulse rounded-lg border ${trackClasses}`} />;
  }

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className={`flex items-center gap-1 rounded-lg border p-1 ${trackClasses}`}
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = theme === option.value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.label}
            title={option.label}
            onClick={() => setTheme(option.value)}
            className={`flex flex-1 items-center justify-center rounded-md py-1.5 transition ${
              active ? activeClasses : inactiveClasses
            }`}
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
}
