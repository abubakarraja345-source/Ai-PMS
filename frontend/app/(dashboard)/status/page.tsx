"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

type ConnectionHealth = "healthy" | "warning" | "error" | "disabled";

interface Integration {
  id: string;
  provider: string;
  accountName: string | null;
  status: string;
  propertyTitle: string | null;
  externalListingName: string | null;
  health: ConnectionHealth;
  lastSuccessfulSyncAt: string | null;
  nextScheduledSyncAt: string | null;
}

const PROVIDER_LABELS: Record<string, string> = {
  airbnb: "Airbnb",
  "booking.com": "Booking.com",
  vrbo: "VRBO",
  ical: "Other Calendar",
  airbnb_api: "Airbnb (Official API)",
};

interface AirbnbApiStatusResponse {
  connected: boolean;
  integrationId: string | null;
  accountName: string | null;
  status: string | null;
  health: ConnectionHealth | null;
  lastSuccessfulSyncAt: string | null;
  listingCount: number;
}

const HEALTH_META: Record<
  ConnectionHealth,
  { label: string; dot: string; text: string; border: string; bg: string }
> = {
  healthy: {
    label: "Healthy",
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    border: "border-emerald-200",
    bg: "bg-emerald-50",
  },
  warning: {
    label: "Needs review",
    dot: "bg-amber-500",
    text: "text-amber-700",
    border: "border-amber-200",
    bg: "bg-amber-50",
  },
  error: {
    label: "Sync failed",
    dot: "bg-red-500",
    text: "text-red-700",
    border: "border-red-200",
    bg: "bg-red-50",
  },
  disabled: {
    label: "Disabled",
    dot: "bg-muted-foreground/50",
    text: "text-foreground/70",
    border: "border-border",
    bg: "bg-muted",
  },
};

function formatRelative(value: string | null) {
  if (!value) return "Never synced";

  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diffMs / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;

  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function integrationLabel(integration: Integration): string {
  return (
    integration.externalListingName ||
    integration.accountName ||
    integration.propertyTitle ||
    PROVIDER_LABELS[integration.provider] ||
    integration.provider
  );
}

export default function StatusCenterPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [icalResponse, airbnbApiResponse] = await Promise.all([
        apiFetch("/api/integrations"),
        apiFetch("/api/integrations/airbnb/status").catch(() => null),
      ]);

      const icalIntegrations: Integration[] = icalResponse.data ?? [];
      const airbnbApiStatus: AirbnbApiStatusResponse | undefined =
        airbnbApiResponse?.data;

      // Keyed on integrationId (a connection has ever existed), not
      // `connected` (service.ts's connected flips to false once
      // disabled so the Integrations page's Connect button can
      // re-trigger) — a disabled Airbnb API connection should still
      // show up here with a "Disabled" badge, matching how a disabled
      // iCal connection also still appears in this same list.
      const airbnbApiEntry: Integration[] =
        airbnbApiStatus?.integrationId
          ? [
              {
                id: airbnbApiStatus.integrationId,
                provider: "airbnb_api",
                accountName: airbnbApiStatus.accountName,
                status: airbnbApiStatus.status ?? "active",
                propertyTitle: null,
                externalListingName:
                  airbnbApiStatus.listingCount > 0
                    ? `${airbnbApiStatus.listingCount} listing${airbnbApiStatus.listingCount === 1 ? "" : "s"} mapped`
                    : null,
                health: airbnbApiStatus.health ?? "warning",
                lastSuccessfulSyncAt: airbnbApiStatus.lastSuccessfulSyncAt,
                nextScheduledSyncAt: null,
              },
            ]
          : [];

      setIntegrations([...icalIntegrations, ...airbnbApiEntry]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load system status."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const buckets: Record<ConnectionHealth, Integration[]> = {
    error: [],
    warning: [],
    disabled: [],
    healthy: [],
  };

  for (const integration of integrations) {
    buckets[integration.health].push(integration);
  }

  const needsAttention = buckets.error.length + buckets.warning.length;
  const orderedGroups: ConnectionHealth[] = [
    "error",
    "warning",
    "healthy",
    "disabled",
  ];

  return (
    <div className="min-h-full">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Status Center
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A single place to monitor every connected calendar&apos;s health.
        </p>
      </div>

      {error && (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Summary */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            { key: "error", label: "Sync Failed" },
            { key: "warning", label: "Needs Review" },
            { key: "healthy", label: "Healthy" },
            { key: "disabled", label: "Disabled" },
          ] as const
        ).map(({ key, label }) => {
          const meta = HEALTH_META[key];

          return (
            <div
              key={key}
              className="rounded-xl border bg-card p-5 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                <p className="text-sm text-muted-foreground">{label}</p>
              </div>

              <p className="mt-2 text-2xl font-semibold text-foreground">
                {loading ? "—" : buckets[key].length}
              </p>
            </div>
          );
        })}
      </div>

      {!loading && needsAttention > 0 && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {needsAttention} connection{needsAttention === 1 ? "" : "s"} need
          {needsAttention === 1 ? "s" : ""} attention.
        </div>
      )}

      {/* List */}
      <div className="mt-6 rounded-xl border bg-card shadow-sm">
        {loading ? (
          <div className="p-12 text-center">
            <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-border border-t-slate-900" />
            <p className="mt-4 text-sm text-muted-foreground">Loading status...</p>
          </div>
        ) : integrations.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-foreground">
              No calendar connections yet
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect a calendar from the Integrations page to see its
              health here.
            </p>
            <Link
              href="/integrations"
              className="mt-4 inline-block rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              Go to Integrations
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {orderedGroups.flatMap((group) =>
              buckets[group].map((integration) => {
                const meta = HEALTH_META[integration.health];

                return (
                  <Link
                    key={integration.id}
                    href="/integrations"
                    className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-muted"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`}
                      />

                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {integrationLabel(integration)}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {PROVIDER_LABELS[integration.provider] ??
                            integration.provider}
                          {integration.propertyTitle
                            ? ` · ${integration.propertyTitle}`
                            : ""}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${meta.border} ${meta.bg} ${meta.text}`}
                      >
                        {meta.label}
                      </span>
                      <p className="mt-1 text-xs text-muted-foreground/80">
                        Last sync: {formatRelative(integration.lastSuccessfulSyncAt)}
                      </p>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
