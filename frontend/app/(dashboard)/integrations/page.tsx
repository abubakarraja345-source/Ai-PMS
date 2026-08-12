"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import AirbnbApiSection from "@/components/integrations/airbnb-api-section";

type ConnectionHealth = "healthy" | "warning" | "error" | "disabled";

interface Integration {
  id: string;
  provider: string;
  accountName: string | null;
  status: string;
  hasFeedConfigured: boolean;
  isSupported: boolean;
  createdAt: string;
  lastSyncAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastSyncError: string | null;
  propertyId: string | null;
  propertyTitle: string | null;
  externalListingName: string | null;
  health: ConnectionHealth;
  consecutiveFailureCount: number;
  lastSyncStartedAt: string | null;
  lastSyncDurationMs: number | null;
  nextScheduledSyncAt: string | null;
}

interface SyncLogEntry {
  id: string;
  event: string;
  status: string;
  imported: number;
  updated: number;
  cancelled: number;
  skipped: number;
  conflicts: number;
  errorMessage: string | null;
  syncedAt: string;
  startedAt: string | null;
  durationMs: number | null;
}

interface PropertyOption {
  id: string;
  title: string;
}

/**
 * Every provider here is delivered via iCal only — there is no
 * official Airbnb/Booking.com/VRBO API integration in this app (see
 * integrations/providers/registry.ts, which has no adapter for any of
 * them). "Other" maps to the existing "ical" provider value, the same
 * one property-channel-links-section.tsx already labels "iCal /
 * Other".
 */
const CONNECTABLE_PROVIDERS: { id: string; label: string }[] = [
  { id: "airbnb", label: "Airbnb" },
  { id: "booking.com", label: "Booking.com" },
  { id: "vrbo", label: "VRBO" },
  { id: "ical", label: "Other" },
];

function providerLabel(providerId: string): string {
  return (
    CONNECTABLE_PROVIDERS.find((p) => p.id === providerId)?.label ??
    providerId
  );
}

function formatDateTime(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
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

/**
 * Health is computed authoritatively by the backend (see
 * integrations/health.ts) from consecutive_failure_count and how
 * stale the last successful sync is, relative to the configured sync
 * interval — never re-derived client-side, so the badge always
 * matches what actually drove any notification the user received.
 */
const HEALTH_LABELS: Record<ConnectionHealth, string> = {
  healthy: "Healthy",
  warning: "Warning",
  error: "Sync Error",
  disabled: "Disabled",
};

const HEALTH_DOT: Record<ConnectionHealth, string> = {
  healthy: "●",
  warning: "●",
  error: "⚠",
  disabled: "●",
};

function healthBadgeClasses(health: ConnectionHealth) {
  switch (health) {
    case "healthy":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "warning":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "error":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
}

function formatCountdown(value: string | null): string {
  if (!value) return "—";

  const diffMs = new Date(value).getTime() - Date.now();
  if (diffMs <= 0) return "due now";

  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "due now";
  if (minutes < 60) return `~${minutes} min`;

  const hours = Math.round(minutes / 60);
  return `~${hours} hr`;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

type WizardStep = "property" | "provider" | "details";

interface WizardState {
  propertyId: string;
  provider: string;
  externalListingName: string;
  externalListingId: string;
  feedUrl: string;
}

const initialWizardState: WizardState = {
  propertyId: "",
  provider: "",
  externalListingName: "",
  externalListingId: "",
  feedUrl: "",
};

interface TestResult {
  eventCount: number;
  sampleEvents: { checkIn: string; checkOut: string; summary: string | null }[];
  dateRange: { start: string; end: string } | null;
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const [reservationCounts, setReservationCounts] = useState<
    Record<string, number>
  >({});
  const [reviewFlags, setReviewFlags] = useState<Record<string, boolean>>({});

  const [syncingId, setSyncingId] = useState<string | null>(null);

  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>("property");
  const [wizard, setWizard] = useState<WizardState>(initialWizardState);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testError, setTestError] = useState("");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const [detailFor, setDetailFor] = useState<Integration | null>(null);
  const [editingListingName, setEditingListingName] = useState(false);
  const [listingNameInput, setListingNameInput] = useState("");

  const [historyFor, setHistoryFor] = useState<Integration | null>(null);
  const [history, setHistory] = useState<SyncLogEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [integrationsRes, propertiesRes] = await Promise.all([
        apiFetch("/api/integrations"),
        apiFetch("/api/properties?limit=100"),
      ]);

      const loadedIntegrations: Integration[] = integrationsRes.data ?? [];
      setIntegrations(loadedIntegrations);
      setProperties(
        (propertiesRes.data ?? []).map((p: { id: string; title: string }) => ({
          id: p.id,
          title: p.title,
        }))
      );

      // Reuses the existing reservations search/filter endpoint with
      // limit=1 to get an exact count cheaply (Postgres's exact count
      // is computed server-side regardless of the limit clause) —
      // the same pattern review-count-badge.tsx already uses, rather
      // than adding a dedicated backend count endpoint.
      const connected = loadedIntegrations.filter(
        (i) => i.provider !== "direct"
      );

      const [counts, flags] = await Promise.all([
        Promise.all(
          connected.map((i) =>
            apiFetch(
              `/api/reservations?search=${encodeURIComponent(`ical:${i.id}:`)}&limit=1`
            )
              .then((r) => [i.id, r.meta?.total ?? 0] as const)
              .catch(() => [i.id, 0] as const)
          )
        ),
        Promise.all(
          connected.map((i) =>
            apiFetch(
              `/api/reservations?search=${encodeURIComponent(`ical:${i.id}:`)}&needs_review=true&limit=1`
            )
              .then((r) => [i.id, (r.meta?.total ?? 0) > 0] as const)
              .catch(() => [i.id, false] as const)
          )
        ),
      ]);

      setReservationCounts(Object.fromEntries(counts));
      setReviewFlags(Object.fromEntries(flags));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load integrations."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    async function loadRole() {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const response = await apiFetch("/api/organization/members");
        const self = (response.data ?? []).find(
          (member: { userId: string }) => member.userId === session?.user?.id
        );

        setCanManage(
          self?.role === "owner" || self?.role === "company_admin"
        );
      } catch {
        setCanManage(false);
      }
    }

    loadRole();
  }, []);

  const connections = integrations.filter(
    (i) => i.provider !== "direct" && i.propertyId
  );

  function availableProperties(): PropertyOption[] {
    // A property already connected for the wizard's chosen provider is
    // excluded — property_channel_links enforces one mapping per
    // property+provider at the database level, so offering it here
    // would just produce a guaranteed 400 on save.
    const takenPropertyIds = new Set(
      integrations
        .filter((i) => i.provider === wizard.provider && i.propertyId)
        .map((i) => i.propertyId)
    );

    return properties.filter((p) => !takenPropertyIds.has(p.id));
  }

  function openWizard() {
    setWizard(initialWizardState);
    setWizardStep("property");
    setTestResult(null);
    setTestError("");
    setShowWizard(true);
  }

  function openWizardForProvider(providerId: string) {
    setWizard({ ...initialWizardState, provider: providerId });
    setWizardStep("property");
    setTestResult(null);
    setTestError("");
    setShowWizard(true);
  }

  function closeWizard() {
    if (saving || testing) return;
    setShowWizard(false);
  }

  async function handleTestConnection() {
    if (!wizard.feedUrl.trim()) {
      setTestError("Enter an iCal URL first.");
      return;
    }

    try {
      setTesting(true);
      setTestError("");
      setTestResult(null);

      const response = await apiFetch("/api/integrations/ical/test", {
        method: "POST",
        body: JSON.stringify({ feedUrl: wizard.feedUrl.trim() }),
      });

      setTestResult(response.data);
    } catch (err) {
      setTestError(
        err instanceof Error ? err.message : "Failed to test this feed URL."
      );
    } finally {
      setTesting(false);
    }
  }

  async function handleSaveConnection() {
    try {
      setSaving(true);
      setError("");

      await apiFetch("/api/integrations/ical", {
        method: "POST",
        body: JSON.stringify({
          propertyId: wizard.propertyId,
          provider: wizard.provider,
          externalListingId: wizard.externalListingId.trim(),
          externalListingName: wizard.externalListingName.trim() || null,
          feedUrl: wizard.feedUrl.trim(),
        }),
      });

      setShowWizard(false);
      setActionMessage("Calendar connected successfully.");
      await loadAll();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to connect this calendar."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSync(integration: Integration) {
    if (!integration.propertyId) return;

    try {
      setSyncingId(integration.id);
      setError("");
      setActionMessage("");

      const response = await apiFetch(
        `/api/integrations/${integration.id}/sync`,
        {
          method: "POST",
          body: JSON.stringify({ propertyId: integration.propertyId }),
        }
      );

      const result = response.data;
      setActionMessage(
        `Sync complete for ${integration.propertyTitle ?? "property"} — ` +
          `imported ${result.imported}, updated ${result.updated}, ` +
          `unchanged ${result.skipped}, needs review ${result.conflicts}.`
      );

      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setSyncingId(null);
    }
  }

  async function handleToggle(integration: Integration) {
    const disabling = integration.status !== "disabled";

    if (disabling) {
      const confirmed = window.confirm(
        `Disable the ${providerLabel(integration.provider)} connection for ${
          integration.propertyTitle ?? "this property"
        }?\n\nSync Now will be unavailable until it's re-enabled.`
      );
      if (!confirmed) return;
    }

    try {
      setError("");
      setActionMessage("");

      const action = integration.status === "disabled" ? "enable" : "disable";

      await apiFetch(`/api/integrations/${integration.id}/${action}`, {
        method: "POST",
      });

      await loadAll();

      if (detailFor?.id === integration.id) {
        setDetailFor(null);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update connection."
      );
    }
  }

  async function handleDelete(integration: Integration) {
    const confirmed = window.confirm(
      `Delete the ${providerLabel(integration.provider)} connection for ${
        integration.propertyTitle ?? "this property"
      }?\n\nThis removes the connection and its sync history. Previously imported reservations are not deleted. This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setError("");

      await apiFetch(`/api/integrations/${integration.id}`, {
        method: "DELETE",
      });

      setDetailFor(null);
      await loadAll();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete connection."
      );
    }
  }

  async function handleSaveListingName(integration: Integration) {
    try {
      setSaving(true);
      setError("");

      await apiFetch(`/api/integrations/${integration.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          externalListingName: listingNameInput.trim() || null,
        }),
      });

      setEditingListingName(false);
      await loadAll();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update connection."
      );
    } finally {
      setSaving(false);
    }
  }

  async function openHistory(integration: Integration) {
    setHistoryFor(integration);
    setHistoryLoading(true);

    try {
      const response = await apiFetch(
        `/api/integrations/${integration.id}/sync-history`
      );
      setHistory(response.data ?? []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  const wizardCanTest = !!wizard.feedUrl.trim();
  const wizardCanSave =
    !!wizard.propertyId &&
    !!wizard.provider &&
    !!wizard.externalListingId.trim() &&
    !!wizard.feedUrl.trim() &&
    !!testResult;

  return (
    <main className="min-h-screen bg-slate-50 p-6 lg:p-10">
      <h1 className="text-4xl font-semibold text-slate-950">Integrations</h1>
      <p className="mt-2 text-lg text-slate-500">
        Manage your property calendar connections.
      </p>

      <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <strong>iCal connection, not an official API integration.</strong>{" "}
        Calendar synchronization via iCal. This does not connect to
        Airbnb&apos;s, Booking.com&apos;s, or VRBO&apos;s API — it imports
        and exports standard calendar (.ics) files, the same mechanism
        every major OTA already supports for third-party calendar sync.
      </div>

      {error && (
        <div className="mt-6 flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          <span>{error}</span>
          <button onClick={() => setError("")} className="font-medium">
            ✕
          </button>
        </div>
      )}

      {actionMessage && (
        <div className="mt-6 flex items-start justify-between gap-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-700">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage("")} className="font-medium">
            ✕
          </button>
        </div>
      )}

      {/* iCal Calendar Connections intro */}
      <div className="mt-8 flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            iCal Calendar Connections
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Connect Airbnb, Booking.com, VRBO, or another calendar provider
            using an iCal feed.
          </p>
        </div>

        {canManage && (
          <button
            onClick={openWizard}
            className="inline-flex items-center justify-center rounded-lg bg-[#10172a] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#18213a]"
          >
            <span className="mr-2 text-lg leading-none">+</span>
            Add iCal Connection
          </button>
        )}
      </div>

      {/* Connected calendars */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Connected Calendars
          </h3>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading connections...
          </div>
        ) : connections.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-slate-700">
              No calendars connected yet.
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Connect a property below to start syncing its calendar.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="px-5 py-3 font-medium text-slate-600">
                    Property
                  </th>
                  <th className="px-5 py-3 font-medium text-slate-600">
                    Provider
                  </th>
                  <th className="px-5 py-3 font-medium text-slate-600">
                    Health
                  </th>
                  <th className="px-5 py-3 font-medium text-slate-600">
                    Last Sync
                  </th>
                  <th className="px-5 py-3 font-medium text-slate-600">
                    Next Sync
                  </th>
                  <th className="px-5 py-3 font-medium text-slate-600">
                    Reservations
                  </th>
                  <th className="px-5 py-3 text-right font-medium text-slate-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {connections.map((integration) => {
                  return (
                    <tr
                      key={integration.id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <button
                          onClick={() => setDetailFor(integration)}
                          className="font-medium text-slate-900 hover:underline"
                        >
                          {integration.propertyTitle ?? "Unknown property"}
                        </button>
                        {integration.externalListingName && (
                          <p className="mt-0.5 text-xs text-slate-500">
                            {integration.externalListingName}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4 text-slate-700">
                        {providerLabel(integration.provider)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${healthBadgeClasses(integration.health)}`}
                          >
                            {HEALTH_DOT[integration.health]} {HEALTH_LABELS[integration.health]}
                          </span>
                          {reviewFlags[integration.id] && (
                            <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                              Needs review
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {formatRelative(integration.lastSyncAt)}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {integration.status === "disabled"
                          ? "—"
                          : formatCountdown(integration.nextScheduledSyncAt)}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {reservationCounts[integration.id] ?? 0}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          {canManage && (
                            <button
                              onClick={() => handleSync(integration)}
                              disabled={
                                syncingId === integration.id ||
                                integration.status === "disabled"
                              }
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                              {syncingId === integration.id
                                ? "Syncing..."
                                : integration.health === "error"
                                  ? "Retry"
                                  : "Sync"}
                            </button>
                          )}
                          <button
                            onClick={() => setDetailFor(integration)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Available providers */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Available Providers
        </h3>

        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CONNECTABLE_PROVIDERS.map((provider) => (
            <div
              key={provider.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h4 className="text-lg font-semibold text-slate-900">
                {provider.label}
              </h4>
              <p className="mt-1 text-sm text-slate-500">
                iCal calendar synchronization
              </p>

              {canManage && (
                <button
                  onClick={() => openWizardForProvider(provider.id)}
                  className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Connect via iCal
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Airbnb Official API — a wholly separate connection from the
          iCal feed above; see the card's own header for why they must
          never be confused with each other. */}
      <AirbnbApiSection canManage={canManage} properties={properties} />

      {/* Connect Calendar wizard */}
      {showWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Connect Calendar
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Step{" "}
                  {wizardStep === "property"
                    ? "1"
                    : wizardStep === "provider"
                      ? "2"
                      : "3"}{" "}
                  of 3
                </p>
              </div>
              <button
                onClick={closeWizard}
                className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6 p-6">
              {wizardStep === "property" && (
                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Select Property
                  </label>
                  <select
                    value={wizard.propertyId}
                    onChange={(e) =>
                      setWizard((w) => ({ ...w, propertyId: e.target.value }))
                    }
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                  >
                    <option value="">Select a property...</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => setWizardStep("provider")}
                    disabled={!wizard.propertyId}
                    className="mt-5 w-full rounded-lg bg-[#10172a] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#18213a] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next: Select Provider
                  </button>
                </div>
              )}

              {wizardStep === "provider" && (
                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Select Provider
                  </label>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {CONNECTABLE_PROVIDERS.map((provider) => (
                      <button
                        key={provider.id}
                        onClick={() =>
                          setWizard((w) => ({ ...w, provider: provider.id }))
                        }
                        className={`rounded-lg border px-3 py-2.5 text-sm font-medium ${
                          wizard.provider === provider.id
                            ? "border-[#10172a] bg-[#10172a] text-white"
                            : "border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {provider.label}
                      </button>
                    ))}
                  </div>

                  {availableProperties().length === 0 &&
                    wizard.provider &&
                    properties.find((p) => p.id === wizard.propertyId) &&
                    !availableProperties().some(
                      (p) => p.id === wizard.propertyId
                    ) && (
                      <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                        The selected property already has a{" "}
                        {providerLabel(wizard.provider)} connection. Choose a
                        different property or provider.
                      </p>
                    )}

                  <div className="mt-5 flex gap-2">
                    <button
                      onClick={() => setWizardStep("property")}
                      className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setWizardStep("details")}
                      disabled={!wizard.provider}
                      className="flex-1 rounded-lg bg-[#10172a] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#18213a] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next: Listing Details
                    </button>
                  </div>
                </div>
              )}

              {wizardStep === "details" && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      Listing Name
                    </label>
                    <input
                      type="text"
                      value={wizard.externalListingName}
                      onChange={(e) =>
                        setWizard((w) => ({
                          ...w,
                          externalListingName: e.target.value,
                        }))
                      }
                      placeholder="e.g. Luxury Apartment — Etihad Town"
                      className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      External Listing ID (optional)
                    </label>
                    <input
                      type="text"
                      value={wizard.externalListingId}
                      onChange={(e) =>
                        setWizard((w) => ({
                          ...w,
                          externalListingId: e.target.value,
                        }))
                      }
                      placeholder="e.g. 123456789"
                      className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      Import iCal URL
                    </label>
                    <input
                      type="text"
                      value={wizard.feedUrl}
                      onChange={(e) => {
                        setWizard((w) => ({ ...w, feedUrl: e.target.value }));
                        setTestResult(null);
                      }}
                      placeholder="https://example.com/calendar/ical/...."
                      className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                    />
                    <p className="mt-1.5 text-xs text-slate-500">
                      Copy the iCal export URL from your property&apos;s
                      calendar settings on the provider.
                    </p>
                  </div>

                  <button
                    onClick={handleTestConnection}
                    disabled={!wizardCanTest || testing}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {testing ? "Testing..." : "Test Connection"}
                  </button>

                  {testError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {testError}
                    </div>
                  )}

                  {testResult && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                      <p className="font-medium">
                        ✓ Connection successful — {testResult.eventCount}{" "}
                        event(s) found.
                      </p>
                      {testResult.dateRange && (
                        <p className="mt-1 text-xs">
                          Date range: {testResult.dateRange.start} to{" "}
                          {testResult.dateRange.end}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 border-t pt-4">
                    <button
                      onClick={() => setWizardStep("provider")}
                      className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleSaveConnection}
                      disabled={!wizardCanSave || saving}
                      className="flex-1 rounded-lg bg-[#10172a] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#18213a] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? "Connecting..." : "Save Connection"}
                    </button>
                  </div>

                  {!testResult && (
                    <p className="text-center text-xs text-slate-400">
                      Test the connection successfully before saving.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Connection detail */}
      {detailFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-5">
              <h2 className="text-lg font-semibold text-slate-900">
                Connection Details
              </h2>
              <button
                onClick={() => {
                  setDetailFor(null);
                  setEditingListingName(false);
                }}
                className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 p-6 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">
                    Property
                  </p>
                  <p className="mt-1 font-medium text-slate-900">
                    {detailFor.propertyTitle ?? "Unknown property"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">
                    Provider
                  </p>
                  <p className="mt-1 font-medium text-slate-900">
                    {providerLabel(detailFor.provider)}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium uppercase text-slate-500">
                  Listing
                </p>
                {editingListingName ? (
                  <div className="mt-1 flex gap-2">
                    <input
                      value={listingNameInput}
                      onChange={(e) => setListingNameInput(e.target.value)}
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                    <button
                      onClick={() => handleSaveListingName(detailFor)}
                      disabled={saving}
                      className="rounded-lg bg-[#10172a] px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="mt-1 flex items-center justify-between">
                    <p className="font-medium text-slate-900">
                      {detailFor.externalListingName ?? "—"}
                    </p>
                    {canManage && (
                      <button
                        onClick={() => {
                          setListingNameInput(
                            detailFor.externalListingName ?? ""
                          );
                          setEditingListingName(true);
                        }}
                        className="text-xs font-medium text-slate-500 hover:text-slate-900"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-medium uppercase text-slate-500">
                  Import URL
                </p>
                <p className="mt-1 font-mono text-xs text-slate-400">
                  ••••••••••••••••••••••••
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase text-slate-500">
                  Health
                </p>
                <span
                  className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${healthBadgeClasses(detailFor.health)}`}
                >
                  {HEALTH_DOT[detailFor.health]} {HEALTH_LABELS[detailFor.health]}
                </span>
                {detailFor.consecutiveFailureCount > 0 && (
                  <p className="mt-1 text-xs text-slate-500">
                    {detailFor.consecutiveFailureCount} consecutive failure
                    {detailFor.consecutiveFailureCount === 1 ? "" : "s"}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">
                    Reservations Imported
                  </p>
                  <p className="mt-1 font-medium text-slate-900">
                    {reservationCounts[detailFor.id] ?? 0}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">
                    Sync Duration
                  </p>
                  <p className="mt-1 text-slate-700">
                    {formatDuration(detailFor.lastSyncDurationMs)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">
                    Last Sync
                  </p>
                  <p className="mt-1 text-slate-700">
                    {formatDateTime(detailFor.lastSyncAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">
                    Last Successful Sync
                  </p>
                  <p className="mt-1 text-slate-700">
                    {formatDateTime(detailFor.lastSuccessfulSyncAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">
                    Next Scheduled Sync
                  </p>
                  <p className="mt-1 text-slate-700">
                    {detailFor.status === "disabled"
                      ? "Paused (disabled)"
                      : formatCountdown(detailFor.nextScheduledSyncAt)}
                  </p>
                </div>
              </div>

              {detailFor.lastSyncError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <p className="font-medium">⚠ Sync Error — Reason</p>
                  <p className="mt-1">{detailFor.lastSyncError}</p>
                </div>
              )}

              {canManage && (
                <div className="flex flex-wrap gap-2 border-t pt-4">
                  <button
                    onClick={() => handleSync(detailFor)}
                    disabled={
                      syncingId === detailFor.id ||
                      detailFor.status === "disabled"
                    }
                    className="rounded-lg bg-[#10172a] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                  >
                    {syncingId === detailFor.id
                      ? "Syncing..."
                      : detailFor.health === "error"
                        ? "Retry Now"
                        : "Sync Now"}
                  </button>
                  <button
                    onClick={() => openHistory(detailFor)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Sync History
                  </button>
                  <button
                    onClick={() => handleToggle(detailFor)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {detailFor.status === "disabled" ? "Enable" : "Disable"}
                  </button>
                  <button
                    onClick={() => handleDelete(detailFor)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sync history */}
      {historyFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                Sync History — {historyFor.propertyTitle ?? "Property"} (
                {providerLabel(historyFor.provider)})
              </h3>
              <button
                onClick={() => setHistoryFor(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <div className="mt-5 max-h-96 overflow-y-auto">
              {historyLoading ? (
                <p className="text-sm text-slate-500">Loading...</p>
              ) : history.length === 0 ? (
                <p className="text-sm text-slate-400">No sync attempts yet.</p>
              ) : (
                <ul className="space-y-2">
                  {history.map((log) => (
                    <li key={log.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span
                          className={`font-medium ${log.status === "success" ? "text-emerald-600" : "text-red-600"}`}
                        >
                          {log.status === "success" ? "✓ Success" : "✕ Failed"}
                          {log.event === "scheduled_sync" && (
                            <span className="ml-1.5 font-normal text-slate-400">
                              (auto)
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-slate-400">
                          {formatDateTime(log.syncedAt)} · {formatDuration(log.durationMs)}
                        </span>
                      </div>

                      {log.status === "success" ? (
                        <p className="mt-1 text-xs text-slate-500">
                          Imported {log.imported} · Updated {log.updated} ·
                          Cancelled {log.cancelled} · Unchanged {log.skipped} ·
                          Needs review {log.conflicts}
                        </p>
                      ) : (
                        log.errorMessage && (
                          <p className="mt-1 text-xs text-red-500">
                            {log.errorMessage}
                          </p>
                        )
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
