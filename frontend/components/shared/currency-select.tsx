"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import {
  CURRENCIES,
  CurrencyMeta,
  SUPPORTED_CURRENCY_CODES,
  getCurrencyMeta,
} from "@/lib/currency";

interface CurrencySelectProps {
  id?: string;
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  /** Restrict the list to a subset — defaults to every supported currency. */
  codes?: string[];
  className?: string;
}

/**
 * A searchable currency combobox: type to filter, arrow keys to
 * navigate, Enter to select, Escape to close. Replaces the plain
 * <select> for the currency-picking UI while <select> is still used
 * for ordinary form fields elsewhere in the app.
 */
export default function CurrencySelect({
  id,
  value,
  onChange,
  disabled,
  codes = SUPPORTED_CURRENCY_CODES,
  className,
}: CurrencySelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const options = useMemo(
    () =>
      codes
        .map((code) => CURRENCIES[code])
        .filter((meta): meta is CurrencyMeta => Boolean(meta)),
    [codes]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (meta) =>
        meta.code.toLowerCase().includes(q) ||
        meta.name.toLowerCase().includes(q)
    );
  }, [options, query]);

  const selected = getCurrencyMeta(value);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
        setQuery("");
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setHighlighted(0);
    const frame = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  function handleSelect(code: string) {
    onChange(code);
    setOpen(false);
    setQuery("");
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
    }
  }

  function handleListKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((current) => Math.min(current + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const meta = filtered[highlighted];
      if (meta) handleSelect(meta.code);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm outline-none transition focus:border-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-slate-400">{selected.symbol}</span>
          <span className="font-medium text-slate-900">{selected.code}</span>
          <span className="truncate text-slate-500">— {selected.name}</span>
        </span>

        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition-transform duration-150 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-20 mt-2 w-full min-w-[280px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5">
            <Search size={15} className="shrink-0 text-slate-400" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setHighlighted(0);
              }}
              onKeyDown={handleListKeyDown}
              placeholder="Search currency..."
              className="w-full text-sm outline-none placeholder:text-slate-400"
            />
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-slate-400">
                No currency matches &ldquo;{query}&rdquo;
              </p>
            ) : (
              filtered.map((meta, index) => {
                const isSelected = meta.code === value;
                return (
                  <button
                    type="button"
                    key={meta.code}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlighted(index)}
                    onClick={() => handleSelect(meta.code)}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition ${
                      index === highlighted ? "bg-slate-50" : ""
                    }`}
                  >
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center text-slate-900">
                      {isSelected && <Check size={14} />}
                    </span>
                    <span className="w-6 shrink-0 text-center text-slate-400">
                      {meta.symbol}
                    </span>
                    <span className="shrink-0 font-medium text-slate-900">
                      {meta.code}
                    </span>
                    <span className="truncate text-slate-500">
                      {meta.name}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
