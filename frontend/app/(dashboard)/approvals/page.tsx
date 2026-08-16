"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import ConfirmDialog from "@/components/shared/confirm-dialog";

interface ApprovalRequest {
  id: string;
  resourceAction: string;
  entityType: string;
  entityId: string;
  requestedBy: string;
  requestedByLabel: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  payload: Record<string, unknown>;
  reviewedBy: string | null;
  reviewedByLabel: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

const STATUS_TABS: { value: "pending" | "approved" | "rejected"; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

function humanizeResourceAction(resourceAction: string) {
  return resourceAction
    .split(",")
    .map((a) => a.split(".")[1]?.replace(/_/g, " ") ?? a)
    .join(", ");
}

function payloadSummary(payload: Record<string, unknown>) {
  const parts: string[] = [];
  if (payload.check_in || payload.check_out) {
    parts.push(`Dates: ${payload.check_in ?? "—"} → ${payload.check_out ?? "—"}`);
  }
  if (payload.status) parts.push(`Status: ${payload.status}`);
  if (payload.total_amount !== undefined) parts.push(`Total: ${payload.total_amount}`);
  if (payload.cleaning_fee !== undefined) parts.push(`Cleaning fee: ${payload.cleaning_fee}`);
  if (payload.taxes !== undefined) parts.push(`Taxes: ${payload.taxes}`);
  return parts.join(" · ") || "No summarizable fields";
}

export default function ApprovalsPage() {
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [confirmTarget, setConfirmTarget] = useState<{
    request: ApprovalRequest;
    action: "approve" | "reject";
  } | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setError("");
      const res = await apiFetch(`/api/approvals?status=${tab}`);
      setRequests(res.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load approval requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function handleConfirm() {
    if (!confirmTarget) return;

    try {
      setBusy(true);
      setError("");

      await apiFetch(`/api/approvals/${confirmTarget.request.id}/${confirmTarget.action}`, {
        method: "POST",
      });

      setMessage(
        confirmTarget.action === "approve"
          ? "Change approved and applied."
          : "Change rejected."
      );
      setConfirmTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
      setConfirmTarget(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Approvals</h1>
      <p className="mt-2 text-muted-foreground">
        Sensitive changes submitted by team members, waiting for review.
      </p>

      {message && (
        <div className="mt-4 flex items-start justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          <span>{message}</span>
          <button onClick={() => setMessage("")} className="font-medium">
            ✕
          </button>
        </div>
      )}
      {error && (
        <div className="mt-4 flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          <span>{error}</span>
          <button onClick={() => setError("")} className="font-medium">
            ✕
          </button>
        </div>
      )}

      <div className="mt-6 flex gap-2">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === t.value
                ? "bg-primary text-white"
                : "border border-border text-foreground/70 hover:bg-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {loading ? (
          <p className="p-10 text-center text-sm text-muted-foreground">Loading...</p>
        ) : requests.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground/80">
            No {tab} approval requests.
          </p>
        ) : (
          <ul className="divide-y">
            {requests.map((r) => (
              <li key={r.id} className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-foreground">
                      {humanizeResourceAction(r.resourceAction)} on a {r.entityType}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Requested by {r.requestedByLabel ?? r.requestedBy} ·{" "}
                      {new Date(r.createdAt).toLocaleString()}
                    </p>
                    <p className="mt-2 text-sm text-foreground/70">{payloadSummary(r.payload)}</p>
                    {r.reviewedByLabel && (
                      <p className="mt-2 text-xs text-muted-foreground/80">
                        Reviewed by {r.reviewedByLabel}
                        {r.reviewNote ? ` — "${r.reviewNote}"` : ""}
                      </p>
                    )}
                  </div>

                  {r.status === "pending" && (
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => setConfirmTarget({ request: r, action: "reject" })}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => setConfirmTarget({ request: r, action: "approve" })}
                        className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                      >
                        Approve
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmTarget}
        title={
          confirmTarget?.action === "approve"
            ? "Approve this change?"
            : "Reject this change?"
        }
        description={
          confirmTarget?.action === "approve"
            ? "This will apply the change immediately."
            : "The requester will be notified their change was not applied."
        }
        tone={confirmTarget?.action === "approve" ? "info" : "warning"}
        confirmLabel={busy ? "Working..." : confirmTarget?.action === "approve" ? "Approve" : "Reject"}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
