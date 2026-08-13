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
    <div className="glass-panel rounded-2xl p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
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
      <h1 className="text-3xl font-semibold text-foreground">Platform Overview</h1>
      <p className="mt-2 text-muted-foreground">Cross-organization health and activity.</p>

      {loading ? (
        <p className="mt-6 text-muted-foreground">Loading...</p>
      ) : error ? (
        <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-destructive">
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

      <div className="mt-8 rounded-2xl border border-primary/20 bg-primary/5 p-6 backdrop-blur-xl">
        <p className="text-sm text-muted-foreground">
          For per-organization detail — team, properties, integrations, currency, recent
          activity — see the Organizations list.
        </p>
        <Link
          href="/admin/organizations"
          className="mt-3 inline-flex items-center rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          View Organizations →
        </Link>
      </div>
    </div>
  );
}
