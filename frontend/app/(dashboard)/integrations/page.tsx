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

interface ChannelOverviewRow {
  propertyId: string;
  propertyTitle: string;
  officialApi: { provider: string; connected: boolean; externalListingId: string } | null;
  ical: { provider: string; integrationId: string; status: string } | null;
  effectiveSource: "official_api" | "ical" | "manual";
}

const SOURCE_LABELS: Record<ChannelOverviewRow["effectiveSource"], string> = {
  official_api: "Official API",
  ical: "iCal",
  manual: "Manual / Not connected",
};

const SOURCE_CLASSES: Record<ChannelOverviewRow["effectiveSource"], string> = {
  official_api: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ical: "bg-blue-50 text-blue-700 border-blue-200",
  manual: "bg-muted text-foreground/70 border-border",
};

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
      return "bg-muted text-foreground/70 border-border";
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

  // "Create a property from this calendar" — an alternative to Step
  // 1's existing property dropdown, so connecting a calendar for a
  // brand-new listing doesn't require a separate trip to Properties
  // first. See createPropertyFromIcalController's own comment for why
  // this only ever fills in the property's name — a standard OTA
  // iCal feed genuinely has no price/bedroom/type data in it.
  const [propertyMode, setPropertyMode] = useState<"existing" | "new">(
    "existing"
  );
  const [newPropertyFeedUrl, setNewPropertyFeedUrl] = useState("");
  const [creatingProperty, setCreatingProperty] = useState(false);
  const [createPropertyError, setCreatePropertyError] = useState("");
  const [createdPropertyName, setCreatedPropertyName] = useState("");

  const [detailFor, setDetailFor] = useState<Integration | null>(null);
  const [editingListingName, setEditingListingName] = useState(false);
  const [listingNameInput, setListingNameInput] = useState("");

  const [historyFor, setHistoryFor] = useState<Integration | null>(null);
  const [history, setHistory] = useState<SyncLogEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [overview, setOverview] = useState<ChannelOverviewRow[]>([]);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [integrationsRes, propertiesRes, overviewRes] = await Promise.all([
        apiFetch("/api/integrations"),
        apiFetch("/api/properties?limit=100"),
        apiFetch("/api/integrations/overview").catch(() => ({ data: [] })),
      ]);

      const loadedIntegrations: Integration[] = integrationsRes.data ?? [];
      setIntegrations(loadedIntegrations);
      setProperties(
        (propertiesRes.data ?? []).map((p: { id: string; title: string }) => ({
          id: p.id,
          title: p.title,
        }))
      );
      setOverview(overviewRes.data ?? []);

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
    setPropertyMode("existing");
    setNewPropertyFeedUrl("");
    setCreatePropertyError("");
    setCreatedPropertyName("");
    setShowWizard(true);
  }

  function closeWizard() {
    if (saving || testing || creatingProperty) return;
    setShowWizard(false);
  }

  async function handleCreatePropertyFromFeed() {
    const feedUrl = newPropertyFeedUrl.trim();

    if (!feedUrl) {
      setCreatePropertyError("Enter an iCal URL first.");
      return;
    }

    try {
      setCreatingProperty(true);
      setCreatePropertyError("");

      const response = await apiFetch("/api/integrations/ical/create-property", {
        method: "POST",
        body: JSON.stringify({ feedUrl }),
      });

      const created: { id: string; title: string } = response.data;

      setProperties((current) => [...current, { id: created.id, title: created.title }]);
      setCreatedPropertyName(created.title);
      setWizard((w) => ({ ...w, propertyId: created.id, feedUrl }));

      // The feed URL is already known now — no need to ask for it
      // again in the details step, so skip straight to provider.
      setWizardStep("provider");
    } catch (err) {
      setCreatePropertyError(
        err instanceof Error
          ? err.message
          : "Failed to create a property from this calendar."
      );
    } finally {
      setCreatingProperty(false);
    }
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
    <main className="min-h-screen bg-background p-6 lg:p-10">
      <h1 className="text-4xl font-semibold text-foreground">Integrations</h1>
      <p className="mt-2 text-lg text-muted-foreground">
        Connect your channels, import your listings, and keep
        reservations in sync — automatically where possible.
      </p>

      <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <strong>Two ways to connect a channel.</strong> Airbnb supports a
        direct Official API connection below. Every provider (including
        Airbnb) can also be connected via iCal — a calendar (.ics) feed
        that syncs availability but not guest details, the same
        fallback mechanism every major OTA already supports.
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

      {/* Connect a Channel — provider cards distinguishing Official API
          from iCal from Manual setup, per Phase 6B. Airbnb's Official
          API button scrolls to the AirbnbApiSection card below (which
          owns the real connect/OAuth state) rather than duplicating
          that logic here. */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold text-foreground">
          Connect a Channel
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose how each channel connects to your properties.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-foreground">Airbnb</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                Official API
              </span>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                iCal
              </span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Connect directly for automatic listing and reservation
              import, or use iCal as a calendar-only fallback.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <a
                href="#airbnb-official-api"
                className="rounded-lg bg-gradient-to-r from-primary to-accent px-3 py-2 text-center text-sm font-medium text-white hover:opacity-90"
              >
                Connect Official API
              </a>
              {canManage && (
                <button
                  onClick={() => openWizardForProvider("airbnb")}
                  className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-muted"
                >
                  Connect via iCal
                </button>
              )}
            </div>
          </div>

          {[
            { id: "booking.com", label: "Booking.com" },
            { id: "vrbo", label: "VRBO" },
            { id: "ical", label: "Other" },
          ].map((provider) => (
            <div
              key={provider.id}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <h3 className="text-lg font-semibold text-foreground">
                {provider.label}
              </h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                  iCal
                </span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                No official API partner integration is configured for this
                provider yet. Connect via iCal calendar sync instead.
              </p>
              {canManage && (
                <button
                  onClick={() => openWizardForProvider(provider.id)}
                  className="mt-4 w-full rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-muted"
                >
                  Connect via iCal
                </button>
              )}
            </div>
          ))}

          <div className="rounded-2xl border border-dashed border-border bg-card p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-foreground">
              Manual Setup
            </h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-foreground/70">
                No channel
              </span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Create and manage a property entirely by hand, with no OTA
              connection of any kind.
            </p>
            <a
              href="/properties/new"
              className="mt-4 block w-full rounded-lg border border-border px-3 py-2 text-center text-sm font-medium text-foreground/80 hover:bg-muted"
            >
              Create Property Manually
            </a>
          </div>
        </div>
      </div>

      {/* Channel Status by Property */}
      {overview.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-6 py-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Channel Status by Property
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="border-b bg-muted">
                <tr>
                  <th className="px-5 py-3 font-medium text-foreground/70">
                    Property
                  </th>
                  <th className="px-5 py-3 font-medium text-foreground/70">
                    Official API
                  </th>
                  <th className="px-5 py-3 font-medium text-foreground/70">
                    iCal
                  </th>
                  <th className="px-5 py-3 font-medium text-foreground/70">
                    Active Source
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {overview.map((row) => (
                  <tr key={row.propertyId}>
                    <td className="px-5 py-3 font-medium text-foreground">
                      {row.propertyTitle}
                    </td>
                    <td className="px-5 py-3 text-foreground/70">
                      {row.officialApi
                        ? row.officialApi.connected
                          ? "Connected"
                          : "Disconnected"
                        : "—"}
                    </td>
                    <td className="px-5 py-3 text-foreground/70">
                      {row.ical
                        ? row.ical.status === "disabled"
                          ? "Disabled"
                          : "Connected"
                        : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${SOURCE_CLASSES[row.effectiveSource]}`}
                      >
                        {SOURCE_LABELS[row.effectiveSource]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* iCal Calendar Connections intro */}
      <div className="mt-8 flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm md:flex-row md:items-center">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            iCal Calendar Connections
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect Airbnb, Booking.com, VRBO, or another calendar provider
            using an iCal feed.
          </p>
        </div>

        {canManage && (
          <button
            onClick={openWizard}
            className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
          >
            <span className="mr-2 text-lg leading-none">+</span>
            Add iCal Connection
          </button>
        )}
      </div>

      {/* Connected calendars */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Connected Calendars
          </h3>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Loading connections...
          </div>
        ) : connections.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-foreground/80">
              No calendars connected yet.
            </p>
            <p className="mt-1 text-sm text-muted-foreground/80">
              Connect a property below to start syncing its calendar.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="border-b bg-muted">
                <tr>
                  <th className="px-5 py-3 font-medium text-foreground/70">
                    Property
                  </th>
                  <th className="px-5 py-3 font-medium text-foreground/70">
                    Provider
                  </th>
                  <th className="px-5 py-3 font-medium text-foreground/70">
                    Health
                  </th>
                  <th className="px-5 py-3 font-medium text-foreground/70">
                    Last Sync
                  </th>
                  <th className="px-5 py-3 font-medium text-foreground/70">
                    Next Sync
                  </th>
                  <th className="px-5 py-3 font-medium text-foreground/70">
                    Reservations
                  </th>
                  <th className="px-5 py-3 text-right font-medium text-foreground/70">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {connections.map((integration) => {
                  return (
                    <tr
                      key={integration.id}
                      className="transition hover:bg-muted"
                    >
                      <td className="px-5 py-4">
                        <button
                          onClick={() => setDetailFor(integration)}
                          className="font-medium text-foreground hover:underline"
                        >
                          {integration.propertyTitle ?? "Unknown property"}
                        </button>
                        {integration.externalListingName && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {integration.externalListingName}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4 text-foreground/80">
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
                      <td className="px-5 py-4 text-foreground/70">
                        {formatRelative(integration.lastSyncAt)}
                      </td>
                      <td className="px-5 py-4 text-foreground/70">
                        {integration.status === "disabled"
                          ? "—"
                          : formatCountdown(integration.nextScheduledSyncAt)}
                      </td>
                      <td className="px-5 py-4 text-foreground/70">
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
                              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-muted disabled:opacity-50"
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
                            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-muted"
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

      {/* Airbnb Official API — a wholly separate connection from the
          iCal feed above; see the card's own header for why they must
          never be confused with each other. */}
      <AirbnbApiSection canManage={canManage} properties={properties} />

      {/* Connect Calendar wizard */}
      {showWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Connect Calendar
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
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
                className="rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6 p-6">
              {wizardStep === "property" && (
                <div>
                  <div className="inline-flex rounded-lg border border-border p-1">
                    <button
                      type="button"
                      onClick={() => setPropertyMode("existing")}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                        propertyMode === "existing"
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground/70 hover:bg-muted"
                      }`}
                    >
                      Use existing property
                    </button>
                    <button
                      type="button"
                      onClick={() => setPropertyMode("new")}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                        propertyMode === "new"
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground/70 hover:bg-muted"
                      }`}
                    >
                      Create from calendar link
                    </button>
                  </div>

                  {propertyMode === "existing" ? (
                    <>
                      <label className="mt-4 block text-sm font-medium text-foreground/80">
                        Select Property
                      </label>
                      <select
                        value={wizard.propertyId}
                        onChange={(e) =>
                          setWizard((w) => ({ ...w, propertyId: e.target.value }))
                        }
                        className="mt-2 w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-primary"
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
                        className="mt-5 w-full rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Next: Select Provider
                      </button>
                    </>
                  ) : (
                    <>
                      <label className="mt-4 block text-sm font-medium text-foreground/80">
                        Calendar (iCal) URL
                      </label>
                      <input
                        type="url"
                        value={newPropertyFeedUrl}
                        onChange={(e) => setNewPropertyFeedUrl(e.target.value)}
                        placeholder="https://www.airbnb.com/calendar/ical/..."
                        className="mt-2 w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-primary"
                      />

                      <p className="mt-2 text-xs text-muted-foreground">
                        We&apos;ll create a new property named after this
                        calendar. Standard calendar exports don&apos;t include
                        price, bedrooms, or property type — you&apos;ll set
                        those once on the new property afterward.
                      </p>

                      {createPropertyError && (
                        <p className="mt-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
                          {createPropertyError}
                        </p>
                      )}

                      {createdPropertyName && !createPropertyError && (
                        <p className="mt-2 rounded-lg border border-success/30 bg-success/10 p-2.5 text-xs text-success">
                          Created &ldquo;{createdPropertyName}&rdquo;.
                        </p>
                      )}

                      <button
                        onClick={handleCreatePropertyFromFeed}
                        disabled={creatingProperty || !newPropertyFeedUrl.trim()}
                        className="mt-5 w-full rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {creatingProperty
                          ? "Fetching calendar..."
                          : "Create Property & Continue"}
                      </button>
                    </>
                  )}
                </div>
              )}

              {wizardStep === "provider" && (
                <div>
                  <label className="text-sm font-medium text-foreground/80">
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
                            ? "border-primary bg-gradient-to-r from-primary to-accent text-white"
                            : "border-border text-foreground/80 hover:bg-muted"
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
                      className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground/80 hover:bg-muted"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setWizardStep("details")}
                      disabled={!wizard.provider}
                      className="flex-1 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next: Listing Details
                    </button>
                  </div>
                </div>
              )}

              {wizardStep === "details" && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground/80">
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
                      className="mt-2 w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground/80">
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
                      className="mt-2 w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground/80">
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
                      className="mt-2 w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-primary"
                    />
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Copy the iCal export URL from your property&apos;s
                      calendar settings on the provider.
                    </p>
                  </div>

                  <button
                    onClick={handleTestConnection}
                    disabled={!wizardCanTest || testing}
                    className="w-full rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground/80 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
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
                      className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground/80 hover:bg-muted"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleSaveConnection}
                      disabled={!wizardCanSave || saving}
                      className="flex-1 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? "Connecting..." : "Save Connection"}
                    </button>
                  </div>

                  {!testResult && (
                    <p className="text-center text-xs text-muted-foreground/80">
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
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-6 py-5">
              <h2 className="text-lg font-semibold text-foreground">
                Connection Details
              </h2>
              <button
                onClick={() => {
                  setDetailFor(null);
                  setEditingListingName(false);
                }}
                className="rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 p-6 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Property
                  </p>
                  <p className="mt-1 font-medium text-foreground">
                    {detailFor.propertyTitle ?? "Unknown property"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Provider
                  </p>
                  <p className="mt-1 font-medium text-foreground">
                    {providerLabel(detailFor.provider)}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Listing
                </p>
                {editingListingName ? (
                  <div className="mt-1 flex gap-2">
                    <input
                      value={listingNameInput}
                      onChange={(e) => setListingNameInput(e.target.value)}
                      className="flex-1 rounded-lg border border-border px-3 py-2 text-sm"
                    />
                    <button
                      onClick={() => handleSaveListingName(detailFor)}
                      disabled={saving}
                      className="rounded-lg bg-gradient-to-r from-primary to-accent px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="mt-1 flex items-center justify-between">
                    <p className="font-medium text-foreground">
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
                        className="text-xs font-medium text-muted-foreground hover:text-foreground"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Import URL
                </p>
                <p className="mt-1 font-mono text-xs text-muted-foreground/80">
                  ••••••••••••••••••••••••
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Health
                </p>
                <span
                  className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${healthBadgeClasses(detailFor.health)}`}
                >
                  {HEALTH_DOT[detailFor.health]} {HEALTH_LABELS[detailFor.health]}
                </span>
                {detailFor.consecutiveFailureCount > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {detailFor.consecutiveFailureCount} consecutive failure
                    {detailFor.consecutiveFailureCount === 1 ? "" : "s"}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Reservations Imported
                  </p>
                  <p className="mt-1 font-medium text-foreground">
                    {reservationCounts[detailFor.id] ?? 0}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Sync Duration
                  </p>
                  <p className="mt-1 text-foreground/80">
                    {formatDuration(detailFor.lastSyncDurationMs)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Last Sync
                  </p>
                  <p className="mt-1 text-foreground/80">
                    {formatDateTime(detailFor.lastSyncAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Last Successful Sync
                  </p>
                  <p className="mt-1 text-foreground/80">
                    {formatDateTime(detailFor.lastSuccessfulSyncAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Next Scheduled Sync
                  </p>
                  <p className="mt-1 text-foreground/80">
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
                    className="rounded-lg bg-gradient-to-r from-primary to-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                  >
                    {syncingId === detailFor.id
                      ? "Syncing..."
                      : detailFor.health === "error"
                        ? "Retry Now"
                        : "Sync Now"}
                  </button>
                  <button
                    onClick={() => openHistory(detailFor)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-muted"
                  >
                    Sync History
                  </button>
                  <button
                    onClick={() => handleToggle(detailFor)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-muted"
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
          <div className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                Sync History — {historyFor.propertyTitle ?? "Property"} (
                {providerLabel(historyFor.provider)})
              </h3>
              <button
                onClick={() => setHistoryFor(null)}
                className="text-muted-foreground/80 hover:text-foreground/80"
              >
                ×
              </button>
            </div>

            <div className="mt-5 max-h-96 overflow-y-auto">
              {historyLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : history.length === 0 ? (
                <p className="text-sm text-muted-foreground/80">No sync attempts yet.</p>
              ) : (
                <ul className="space-y-2">
                  {history.map((log) => (
                    <li key={log.id} className="rounded-xl bg-muted p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span
                          className={`font-medium ${log.status === "success" ? "text-emerald-600" : "text-red-600"}`}
                        >
                          {log.status === "success" ? "✓ Success" : "✕ Failed"}
                          {log.event === "scheduled_sync" && (
                            <span className="ml-1.5 font-normal text-muted-foreground/80">
                              (auto)
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground/80">
                          {formatDateTime(log.syncedAt)} · {formatDuration(log.durationMs)}
                        </span>
                      </div>

                      {log.status === "success" ? (
                        <p className="mt-1 text-xs text-muted-foreground">
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
