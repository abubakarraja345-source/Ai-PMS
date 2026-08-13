"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface PlatformStats {
  totalOrganizations: number;
  activeOrganizations: number;
  suspendedOrganizations: number;
  totalUsers: number;
  totalProperties: number;
  totalReservations: number;
  activeIntegrations: number;
  failedIntegrations: number;
  reviewRequired: number;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export default function PlatformOverviewPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");
        const res = await apiFetch("/api/platform-admin/stats");
        setStats(res.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load platform stats.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-semibold text-white">Platform Overview</h1>
      <p className="mt-2 text-slate-400">Cross-organization health and activity.</p>

      {loading ? (
        <p className="mt-6 text-slate-400">Loading...</p>
      ) : error ? (
        <div className="mt-6 rounded-2xl border border-red-900/40 bg-red-950/40 p-6 text-red-300">
          {error}
        </div>
      ) : (
        stats && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Organizations" value={stats.totalOrganizations} />
            <StatCard label="Active Organizations" value={stats.activeOrganizations} />
            <StatCard label="Suspended Organizations" value={stats.suspendedOrganizations} />
            <StatCard label="Total Users" value={stats.totalUsers} />
            <StatCard label="Total Properties" value={stats.totalProperties} />
            <StatCard label="Total Reservations" value={stats.totalReservations} />
            <StatCard label="Active Integrations" value={stats.activeIntegrations} />
            <StatCard label="Failed Integrations" value={stats.failedIntegrations} />
            <StatCard label="Review Required" value={stats.reviewRequired} />
          </div>
        )
      )}

      <div className="mt-8 rounded-2xl border border-violet-900/40 bg-violet-950/20 p-6">
        <p className="text-sm text-slate-300">
          For per-organization detail — team, properties, integrations, currency, recent
          activity — see the Organizations list.
        </p>
        <Link
          href="/admin/organizations"
          className="mt-3 inline-flex items-center rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500"
        >
          View Organizations →
        </Link>
      </div>
    </div>
  );
}
