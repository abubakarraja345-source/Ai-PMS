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
 * Light/Dark/System toggle for the sidebar. Renders a stable
 * placeholder until mounted — `next-themes`' resolved value isn't
 * known on the server, so rendering the real state before hydration
 * would mismatch.
 */
export default function ThemeToggle({ variant = "light" }: { variant?: "light" | "dark" }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const trackClasses =
    variant === "dark"
      ? "border-white/10 bg-white/5"
      : "border-sidebar-border bg-white/5";

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
              active
                ? "bg-sidebar-primary text-white"
                : "text-slate-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
}
