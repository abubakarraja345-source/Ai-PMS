"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

/**
 * Self-contained, same pattern as ExchangeRatesTable — its own
 * fetch/save cycle, independent of the parent Settings page's big
 * form/save flow, since it talks to a completely different endpoint
 * (/api/organization/approval-settings, not /api/organization/settings).
 */
export default function ApprovalSettingsSection({ canEdit }: { canEdit: boolean }) {
  const [requireApproval, setRequireApproval] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch("/api/organization/approval-settings");
        setRequireApproval(res.data.requireApprovalForMembers);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load approval settings.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  async function handleToggle() {
    if (requireApproval === null) return;

    const next = !requireApproval;

    try {
      setSaving(true);
      setError("");
      await apiFetch("/api/organization/approval-settings", {
        method: "POST",
        body: JSON.stringify({ requireApprovalForMembers: next }),
      });
      setRequireApproval(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update approval settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">Approval Rules</h2>
      <p className="mt-1 text-sm text-slate-500">
        Whether Member-role edits to reservation dates, cancellations, and
        financial fields require approval from a Manager, Admin, or Owner
        before taking effect.
      </p>

      {loading ? (
        <p className="mt-4 text-sm text-slate-400">Loading...</p>
      ) : (
        <div className="mt-5 flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3.5">
          <div>
            <p className="text-sm font-medium text-slate-900">
              Require approval for Member reservation changes
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {requireApproval
                ? "On — Members' date/cancellation/financial edits are held for review."
                : "Off — Members can edit reservations freely, same as before this feature existed."}
            </p>
          </div>

          <button
            onClick={handleToggle}
            disabled={!canEdit || saving}
            role="switch"
            aria-checked={requireApproval ?? false}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${
              requireApproval ? "bg-slate-900" : "bg-slate-300"
            }`}
            title={
              canEdit
                ? undefined
                : "You don't have permission to perform this action."
            }
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                requireApproval ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}
