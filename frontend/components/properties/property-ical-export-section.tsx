"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function PropertyIcalExportSection({
  propertyId,
  canManage,
}: {
  propertyId: string;
  canManage: boolean;
}) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await apiFetch(
        `/api/properties/${propertyId}/ical-export`
      );

      setEnabled(!!response.data?.enabled);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load export status."
      );
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function handleGenerate() {
    const confirmed = enabled
      ? window.confirm(
          "Regenerate the PMS calendar feed URL?\n\nThe previous URL will stop working immediately — update it in every provider that currently uses it.\n\nCancel / Regenerate"
        )
      : true;

    if (!confirmed) return;

    try {
      setGenerating(true);
      setError("");

      const response = await apiFetch(
        `/api/properties/${propertyId}/ical-export/regenerate`,
        { method: "POST" }
      );

      setFreshToken(response.data.token);
      setCopied(false);
      setEnabled(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate export URL."
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (!freshToken) return;

    const url = `${API_URL}/api/ical/${freshToken}.ics`;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — the URL is still visible to select
      // manually, so this isn't fatal.
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">
        PMS Calendar Feed
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Use this URL in Airbnb, Booking.com, VRBO, or another calendar
        provider that supports iCal imports. It exposes only booking dates
        — no guest, contact, or payment information.
      </p>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-5 text-sm text-slate-500">Loading...</div>
      ) : (
        <div className="mt-5">
          {freshToken ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-medium text-emerald-800">
                Feed URL generated — copy it now.
              </p>
              <p className="mt-1 text-xs text-emerald-700">
                This is the only time the full URL is shown.
              </p>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  readOnly
                  value={`${API_URL}/api/ical/${freshToken}.ics`}
                  onFocus={(e) => e.target.select()}
                  className="flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs text-slate-700"
                />
                <button
                  onClick={handleCopy}
                  className="shrink-0 rounded-lg bg-[#10172a] px-4 py-2 text-xs font-medium text-white hover:bg-[#18213a]"
                >
                  {copied ? "Copied!" : "Copy iCal URL"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {enabled ? "Feed enabled" : "No feed generated yet"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {enabled
                    ? "Regenerate to get a fresh URL — this invalidates the old one."
                    : "Generate a secure URL to share this property's availability."}
                </p>
              </div>

              {canManage && (
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="shrink-0 rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {generating
                    ? "Generating..."
                    : enabled
                      ? "Regenerate URL"
                      : "Generate Feed URL"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
