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
      <h1 className="text-3xl font-semibold text-foreground">Organizations</h1>
      <p className="mt-2 text-muted-foreground">
        Every organization on the platform, at a glance.
      </p>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by organization or owner email..."
        className="mt-4 w-full max-w-md rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
      />

      <div className="solid-panel mt-6 overflow-hidden rounded-2xl">
        {loading ? (
          <p className="p-10 text-center text-sm text-muted-foreground">Loading...</p>
        ) : error ? (
          <div className="p-6 text-sm text-destructive">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="px-5 py-3 font-medium text-muted-foreground">Organization</th>
                  <th className="px-5 py-3 font-medium text-muted-foreground">Owner</th>
                  <th className="px-5 py-3 font-medium text-muted-foreground">Members</th>
                  <th className="px-5 py-3 font-medium text-muted-foreground">Properties</th>
                  <th className="px-5 py-3 font-medium text-muted-foreground">Reservations</th>
                  <th className="px-5 py-3 font-medium text-muted-foreground">Integrations</th>
                  <th className="px-5 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="px-5 py-3 font-medium text-muted-foreground">Last Activity</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((org) => (
                  <tr key={org.id} className="hover:bg-muted/40">
                    <td className="px-5 py-3 font-medium text-foreground">{org.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{org.ownerEmail ?? "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{org.memberCount}</td>
                    <td className="px-5 py-3 text-muted-foreground">{org.propertyCount}</td>
                    <td className="px-5 py-3 text-muted-foreground">{org.reservationCount}</td>
                    <td className="px-5 py-3 text-muted-foreground">{org.integrationCount}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
                          org.subscriptionStatus === "suspended"
                            ? "border-destructive/30 bg-destructive/10 text-destructive"
                            : "border-success/30 bg-success/10 text-success"
                        }`}
                      >
                        {org.subscriptionStatus}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {formatRelative(org.lastActivityAt)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/admin/organizations/${org.id}`}
                        className="text-sm font-medium text-primary hover:opacity-80"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-5 py-10 text-center text-muted-foreground/80">
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
