"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

type ToastTone = "success" | "error" | "info" | "warning";

interface ToastState {
  title: string;
  description?: string;
  tone: ToastTone;
}

const TONE_STYLES: Record<
  ToastTone,
  { border: string; icon: typeof CheckCircle2; iconColor: string }
> = {
  success: {
    border: "border-emerald-200",
    icon: CheckCircle2,
    iconColor: "text-emerald-600",
  },
  error: {
    border: "border-red-200",
    icon: XCircle,
    iconColor: "text-red-600",
  },
  warning: {
    border: "border-amber-200",
    icon: AlertTriangle,
    iconColor: "text-amber-600",
  },
  info: {
    border: "border-blue-200",
    icon: Info,
    iconColor: "text-blue-600",
  },
};

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
      {(() => {
        const { border, icon: Icon, iconColor } = TONE_STYLES[toast.tone];
        return (
          <div
            className={`flex items-start gap-3 rounded-xl border bg-white p-4 shadow-lg ${border}`}
          >
            <Icon size={18} className={`mt-0.5 shrink-0 ${iconColor}`} />

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900">
                {toast.title}
              </p>
              {toast.description && (
                <p className="mt-1 text-sm text-slate-500">
                  {toast.description}
                </p>
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
        );
      })()}
    </div>
  ) : null;

  return { showToast, ToastViewport };
}
