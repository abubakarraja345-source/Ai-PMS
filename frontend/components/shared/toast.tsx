"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

type ToastTone = "success" | "error";

interface ToastState {
  title: string;
  description?: string;
  tone: ToastTone;
}

/**
 * Lightweight, page-local toast — no global provider, so each page that
 * wants one calls useToast() and renders the returned viewport wherever
 * convenient. Auto-dismisses after 4s.
 */
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((next: ToastState) => {
    setToast(next);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const ToastViewport = toast ? (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-[70] w-full max-w-sm animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <div
        className={`flex items-start gap-3 rounded-xl border bg-white p-4 shadow-lg ${
          toast.tone === "success" ? "border-emerald-200" : "border-red-200"
        }`}
      >
        {toast.tone === "success" ? (
          <CheckCircle2
            size={18}
            className="mt-0.5 shrink-0 text-emerald-600"
          />
        ) : (
          <XCircle size={18} className="mt-0.5 shrink-0 text-red-600" />
        )}

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900">{toast.title}</p>
          {toast.description && (
            <p className="mt-1 text-sm text-slate-500">{toast.description}</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setToast(null)}
          className="shrink-0 text-slate-400 hover:text-slate-600"
          aria-label="Dismiss notification"
        >
          ✕
        </button>
      </div>
    </div>
  ) : null;

  return { showToast, ToastViewport };
}
