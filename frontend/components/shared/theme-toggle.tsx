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
 * Fixed dual navy/gray-blue palette (specified directly, not the
 * per-org color-theme tokens) — same combo on both the sidebar
 * (dark surface) and Settings (light card), just applied to the two
 * ends of it: dark tones for the sidebar's track/active state, light
 * tones for Settings'.
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
      ? "border-[#9BA8AB]/50 bg-[#CCD0CF]/60"
      : "border-[#4A5C6A]/50 bg-[#11212D]/70";

  const activeClasses =
    variant === "surface"
      ? "bg-[#4E5775] text-white"
      : "bg-[#4E5775] text-white";

  const inactiveClasses =
    variant === "surface"
      ? "text-[#253745] hover:bg-[#9BA8AB]/40 hover:text-[#06141B]"
      : "text-[#9BA8AB] hover:bg-white/10 hover:text-[#CCD0CF]";

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
