"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface PlatformAuditEntry {
  id: string;
  action: string;
  actor_label: string | null;
  organization_id: string | null;
  reason: string | null;
  created_at: string;
}

export default function PlatformAuditLogPage() {
  const [entries, setEntries] = useState<PlatformAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await apiFetch("/api/platform-admin/audit-log");
        setEntries(res.data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load platform audit log.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-semibold text-white">Platform Audit Log</h1>
      <p className="mt-2 text-slate-400">
        Every platform-administrator action — organization entries, suspensions, and more.
      </p>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <p className="p-10 text-center text-sm text-slate-500">Loading...</p>
        ) : error ? (
          <div className="p-6 text-sm text-red-700">{error}</div>
        ) : entries.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-400">No platform admin activity yet.</p>
        ) : (
          <ul className="divide-y">
            {entries.map((e) => (
              <li key={e.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-slate-900">{e.action}</span>
                  <span className="text-xs text-slate-400">
                    {new Date(e.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {e.actor_label ?? "Unknown admin"}
                  {e.reason ? ` — "${e.reason}"` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
