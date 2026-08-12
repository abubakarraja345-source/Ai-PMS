"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getCurrencyMeta } from "@/lib/currency";
import { useToast } from "@/components/shared/toast";

interface RateEntry {
  targetCurrency: string;
  rate: number | null;
  source: "auto" | "manual" | null;
  fetchedAt: string | null;
}

interface ExchangeRatesTableProps {
  baseCurrency: string;
  mode: "auto" | "manual";
  canEdit: boolean;
}

/**
 * Lists every supported currency paired against the org's base
 * currency, with whatever rate is on file. In manual mode,
 * owner/company_admin can edit a rate inline — saved directly via
 * PATCH /api/organization/exchange-rates/:targetCurrency (a separate
 * resource from the rest of Settings, so it saves immediately rather
 * than waiting for the page's own "Save Changes" flow).
 */
export default function ExchangeRatesTable({
  baseCurrency,
  mode,
  canEdit,
}: ExchangeRatesTableProps) {
  const [rates, setRates] = useState<RateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingCurrency, setEditingCurrency] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const { showToast, ToastViewport } = useToast();

  async function load() {
    try {
      setLoading(true);
      setError("");

      const response = await apiFetch("/api/organization/exchange-rates");
      setRates(response.data?.rates ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load exchange rates."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseCurrency]);

  async function saveManualRate(targetCurrency: string) {
    const rate = Number(editValue);

    if (!Number.isFinite(rate) || rate <= 0) {
      showToast({
        tone: "error",
        title: "Invalid rate",
        description: "Enter a positive number.",
      });
      return;
    }

    try {
      setSaving(true);

      await apiFetch(`/api/organization/exchange-rates/${targetCurrency}`, {
        method: "PATCH",
        body: JSON.stringify({ rate }),
      });

      showToast({
        tone: "success",
        title: "Rate updated",
        description: `1 ${targetCurrency} = ${rate} ${baseCurrency}`,
      });

      setEditingCurrency(null);
      await load();
    } catch (err) {
      showToast({
        tone: "error",
        title: "Unable to update rate",
        description:
          err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-2 px-6 py-5">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-12 animate-pulse rounded-lg bg-slate-100"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="px-6 py-5 text-sm text-red-600">{error}</p>;
  }

  return (
    <div className="border-t border-slate-100">
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-6 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        <span>Currency</span>
        <span>Rate</span>
        <span>Updated</span>
        <span />
      </div>

      <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
        {rates.map((entry) => {
          const meta = getCurrencyMeta(entry.targetCurrency);
          const isEditing = editingCurrency === entry.targetCurrency;

          return (
            <div
              key={entry.targetCurrency}
              className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-6 py-3"
            >
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {meta.code}
                </p>
                <p className="text-xs text-slate-500">{meta.name}</p>
              </div>

              <div className="text-sm tabular-nums text-slate-700">
                {isEditing ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(event) => setEditValue(event.target.value)}
                    className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-slate-900"
                    placeholder="0.00"
                  />
                ) : entry.rate !== null ? (
                  entry.rate.toLocaleString(undefined, {
                    maximumFractionDigits: 6,
                  })
                ) : (
                  <span className="text-slate-400">Not set</span>
                )}
              </div>

              <span className="text-xs text-slate-400">
                {entry.fetchedAt
                  ? new Date(entry.fetchedAt).toLocaleDateString()
                  : "—"}
              </span>

              <div className="text-right">
                {canEdit &&
                  mode === "manual" &&
                  (isEditing ? (
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => saveManualRate(entry.targetCurrency)}
                        disabled={saving}
                        className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCurrency(null)}
                        className="text-xs font-medium text-slate-400 hover:text-slate-600"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCurrency(entry.targetCurrency);
                        setEditValue(
                          entry.rate !== null ? String(entry.rate) : ""
                        );
                      }}
                      className="text-xs font-medium text-slate-600 hover:text-slate-900"
                    >
                      Edit
                    </button>
                  ))}
              </div>
            </div>
          );
        })}
      </div>

      {ToastViewport}
    </div>
  );
}
