"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { PaginationControls } from "@/components/shared/pagination-controls";

interface AuditLogEntry {
  id: string;
  actor_user_id: string | null;
  actor_label: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  "reservation.created": "Created reservation",
  "reservation.cancelled": "Cancelled reservation",
  "reservation.review_cleared": "Cleared review flag",
  "member.role_changed": "Changed member role",
  "member.removed": "Removed member",
  "invitation.created": "Sent invitation",
  "invitation.resent": "Resent invitation",
  "invitation.revoked": "Revoked invitation",
  "integration.connected": "Connected calendar",
  "currency.organization_changed": "Changed organization currency",
  "currency.property_changed": "Changed property currency",
};

const ENTITY_TYPES = [
  "reservation",
  "member",
  "invitation",
  "integration",
  "organization",
  "property",
] as const;

function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? action;
}

function formatMetadata(metadata: Record<string, unknown> | null): string {
  if (!metadata) return "";

  return Object.entries(metadata)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" · ");
}

export default function AuditLogPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-full">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Audit Log
          </h1>
        </div>
      }
    >
      <AuditLogContent />
    </Suspense>
  );
}

function AuditLogContent() {
  const searchParams = useSearchParams();
  const initialEntityId = searchParams.get("entity_id") ?? "";

  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);

  const [entityType, setEntityType] = useState(
    searchParams.get("entity_type") ?? "all"
  );
  const [entityId, setEntityId] = useState(initialEntityId);
  const [action, setAction] = useState("all");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setForbidden(false);

      const params = new URLSearchParams();
      if (entityType !== "all") params.set("entity_type", entityType);
      if (entityId) params.set("entity_id", entityId);
      if (action !== "all") params.set("action", action);
      if (start) params.set("start", start);
      if (end) params.set("end", end);
      params.set("page", String(page));

      const response = await apiFetch(`/api/audit-log?${params.toString()}`);

      setEntries(response.data ?? []);
      setTotalPages(response.meta?.totalPages ?? 1);
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.includes("permission to perform")
      ) {
        setForbidden(true);
      } else {
        setError(
          err instanceof Error ? err.message : "Failed to load audit log."
        );
      }
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, action, start, end, page]);

  useEffect(() => {
    setPage(1);
  }, [entityType, entityId, action, start, end]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (forbidden) {
    return (
      <div className="min-h-full">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Audit Log
        </h1>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Only an owner or company admin can view the organization&apos;s
          activity history.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Audit Log
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Who did what, when — reservations, team, currency, and calendar
          connections.
        </p>
      </div>

      {error && (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {entityId && (
        <div className="mt-5 flex items-center justify-between gap-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <span>Filtered to a single {entityType !== "all" ? entityType : "entity"}.</span>
          <button
            onClick={() => setEntityId("")}
            className="font-medium underline underline-offset-2 hover:text-blue-900"
          >
            Clear
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="mt-6 flex flex-wrap gap-3 rounded-xl border bg-white p-4 shadow-sm">
        <select
          value={entityType}
          onChange={(event) => setEntityType(event.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400"
        >
          <option value="all">All entities</option>
          {ENTITY_TYPES.map((type) => (
            <option key={type} value={type} className="capitalize">
              {type}
            </option>
          ))}
        </select>

        <select
          value={action}
          onChange={(event) => setAction(event.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400"
        >
          <option value="all">All actions</option>
          {Object.entries(ACTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={start}
          onChange={(event) => setStart(event.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400"
        />

        <span className="self-center text-sm text-slate-400">to</span>

        <input
          type="date"
          value={end}
          onChange={(event) => setEnd(event.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400"
        />

        <button
          onClick={loadData}
          disabled={loading}
          className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="mt-6 overflow-hidden rounded-xl border bg-white shadow-sm">
        {loading ? (
          <div className="p-12 text-center">
            <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
            <p className="mt-4 text-sm text-slate-500">Loading activity...</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-slate-900">
              No activity recorded yet
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Actions like creating a reservation or inviting a team member
              will show up here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="px-5 py-4 font-medium text-slate-600">
                    Time
                  </th>
                  <th className="px-5 py-4 font-medium text-slate-600">
                    User
                  </th>
                  <th className="px-5 py-4 font-medium text-slate-600">
                    Action
                  </th>
                  <th className="px-5 py-4 font-medium text-slate-600">
                    Entity
                  </th>
                  <th className="px-5 py-4 font-medium text-slate-600">
                    Details
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {entries.map((entry) => (
                  <tr key={entry.id} className="transition hover:bg-slate-50">
                    <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                      {new Date(entry.created_at).toLocaleString()}
                    </td>

                    <td className="px-5 py-4 font-medium text-slate-800">
                      {entry.actor_label ?? "System"}
                    </td>

                    <td className="px-5 py-4">
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {actionLabel(entry.action)}
                      </span>
                    </td>

                    <td className="px-5 py-4 capitalize text-slate-700">
                      {entry.entity_type}
                    </td>

                    <td className="max-w-xs truncate px-5 py-4 text-xs text-slate-400">
                      {formatMetadata(entry.metadata)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PaginationControls
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}
