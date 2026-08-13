"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface OrganizationHealthRow {
  id: string;
  name: string;
  ownerEmail: string | null;
  memberCount: number;
  propertyCount: number;
  reservationCount: number;
  integrationCount: number;
  subscriptionStatus: string;
  subscriptionPlan: string;
  lastActivityAt: string | null;
  createdAt: string;
}

function formatRelative(value: string | null) {
  if (!value) return "Never";
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default function PlatformOrganizationsPage() {
  const [orgs, setOrgs] = useState<OrganizationHealthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");
        const res = await apiFetch("/api/platform-admin/organizations");
        setOrgs(res.data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load organizations.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const filtered = orgs.filter(
    (o) =>
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      (o.ownerEmail ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <h1 className="text-3xl font-semibold text-white">Organizations</h1>
      <p className="mt-2 text-slate-400">
        Every organization on the platform, at a glance.
      </p>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by organization or owner email..."
        className="mt-4 w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-500"
      />

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <p className="p-10 text-center text-sm text-slate-500">Loading...</p>
        ) : error ? (
          <div className="p-6 text-sm text-red-700">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="px-5 py-3 font-medium text-slate-600">Organization</th>
                  <th className="px-5 py-3 font-medium text-slate-600">Owner</th>
                  <th className="px-5 py-3 font-medium text-slate-600">Members</th>
                  <th className="px-5 py-3 font-medium text-slate-600">Properties</th>
                  <th className="px-5 py-3 font-medium text-slate-600">Reservations</th>
                  <th className="px-5 py-3 font-medium text-slate-600">Integrations</th>
                  <th className="px-5 py-3 font-medium text-slate-600">Status</th>
                  <th className="px-5 py-3 font-medium text-slate-600">Last Activity</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((org) => (
                  <tr key={org.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-900">{org.name}</td>
                    <td className="px-5 py-3 text-slate-600">{org.ownerEmail ?? "—"}</td>
                    <td className="px-5 py-3 text-slate-600">{org.memberCount}</td>
                    <td className="px-5 py-3 text-slate-600">{org.propertyCount}</td>
                    <td className="px-5 py-3 text-slate-600">{org.reservationCount}</td>
                    <td className="px-5 py-3 text-slate-600">{org.integrationCount}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
                          org.subscriptionStatus === "suspended"
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {org.subscriptionStatus}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {formatRelative(org.lastActivityAt)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/admin/organizations/${org.id}`}
                        className="text-sm font-medium text-violet-700 hover:text-violet-900"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-5 py-10 text-center text-slate-400">
                      No organizations found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
