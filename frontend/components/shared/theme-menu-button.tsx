"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Monitor, Check } from "lucide-react";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

/**
 * Single icon button (sidebar top-right) that opens an animated
 * dropdown of the Light/Dark/System options — replaces the old
 * always-visible three-button pill that used to sit at the bottom of
 * the sidebar (theme-toggle.tsx, still used as-is on the Settings
 * page, where an always-visible control fits the "personal
 * preference" section better than a menu would).
 */
export default function ThemeMenuButton() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!mounted) {
    return <div className="h-8 w-8 animate-pulse rounded-lg bg-white/5" />;
  }

  const activeOption = OPTIONS.find((o) => o.value === theme) ?? OPTIONS[2];
  const ActiveIcon = activeOption.icon;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Change theme"
        title="Change theme"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
      >
        <ActiveIcon size={16} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 w-44 origin-top-right rounded-xl border border-white/10 bg-slate-900/95 p-1.5 shadow-xl backdrop-blur-xl animate-in fade-in zoom-in-95 slide-in-from-top-1 duration-150"
        >
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = theme === option.value;

            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setTheme(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon size={14} />
                {option.label}
                {active && <Check size={14} className="ml-auto" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
