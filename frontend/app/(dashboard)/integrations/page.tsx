"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

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
}

interface PropertyOption {
  id: string;
  title: string;
}

const PROVIDERS: { id: string; label: string; supported: boolean }[] = [
  { id: "ical", label: "iCal Feed", supported: true },
  { id: "airbnb", label: "Airbnb", supported: false },
  { id: "booking.com", label: "Booking.com", supported: false },
  { id: "vrbo", label: "VRBO", supported: false },
  { id: "direct", label: "Direct", supported: false },
];

function formatDateTime(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

function statusClasses(status: string) {
  switch (status) {
    case "active":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "error":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [configuring, setConfiguring] = useState<{
    provider: string;
  } | null>(null);
  const [feedUrl, setFeedUrl] = useState("");
  const [accountName, setAccountName] = useState("");
  const [saving, setSaving] = useState(false);

  const [historyFor, setHistoryFor] = useState<Integration | null>(null);
  const [history, setHistory] = useState<SyncLogEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncPropertyByIntegration, setSyncPropertyByIntegration] = useState<
    Record<string, string>
  >({});
  const [actionMessage, setActionMessage] = useState<string>("");

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [integrationsRes, propertiesRes] = await Promise.all([
        apiFetch("/api/integrations"),
        apiFetch("/api/properties"),
      ]);

      setIntegrations(integrationsRes.data ?? []);
      setProperties(
        (propertiesRes.data ?? []).map((p: { id: string; title: string }) => ({
          id: p.id,
          title: p.title,
        }))
      );
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
          (member: { userId: string }) =>
            member.userId === session?.user?.id
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

  function integrationFor(providerId: string): Integration | undefined {
    return integrations.find((i) => i.provider === providerId);
  }

  async function handleSaveConfiguration() {
    if (!configuring) return;

    try {
      setSaving(true);
      setError("");

      const existing = integrationFor(configuring.provider);

      if (existing) {
        await apiFetch(`/api/integrations/${existing.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            accountName: accountName.trim() || null,
            feedUrl: feedUrl.trim() || null,
          }),
        });
      } else {
        await apiFetch("/api/integrations", {
          method: "POST",
          body: JSON.stringify({
            provider: configuring.provider,
            accountName: accountName.trim() || null,
            feedUrl: feedUrl.trim() || null,
          }),
        });
      }

      setConfiguring(null);
      setFeedUrl("");
      setAccountName("");
      await loadAll();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save integration."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(integration: Integration) {
    try {
      setError("");
      setActionMessage("");

      const action = integration.status === "disabled" ? "enable" : "disable";

      await apiFetch(`/api/integrations/${integration.id}/${action}`, {
        method: "POST",
      });

      await loadAll();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update integration."
      );
    }
  }

  async function handleTest(integration: Integration) {
    try {
      setError("");
      setActionMessage("");

      const response = await apiFetch(
        `/api/integrations/${integration.id}/test`,
        { method: "POST" }
      );

      setActionMessage(
        response.data.success
          ? `Connection successful — found ${response.data.eventCount} event(s) in the feed.`
          : `Connection failed: ${response.data.errorMessage}`
      );

      await loadAll();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to test connection."
      );
    }
  }

  async function handleSync(integration: Integration) {
    const propertyId = syncPropertyByIntegration[integration.id];

    if (!propertyId) {
      setError("Select which property this sync applies to first.");
      return;
    }

    try {
      setSyncingId(integration.id);
      setError("");
      setActionMessage("");

      const response = await apiFetch(
        `/api/integrations/${integration.id}/sync`,
        {
          method: "POST",
          body: JSON.stringify({ propertyId }),
        }
      );

      const result = response.data;
      setActionMessage(
        `Sync complete — imported ${result.imported}, updated ${result.updated}, cancelled ${result.cancelled}, skipped ${result.skipped}, conflicts ${result.conflicts}.`
      );

      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setSyncingId(null);
    }
  }

  async function handleDelete(integration: Integration) {
    const confirmed = window.confirm(
      `Remove this ${integration.provider} integration?\n\nThis will also delete its sync history. This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setError("");

      await apiFetch(`/api/integrations/${integration.id}`, {
        method: "DELETE",
      });

      await loadAll();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete integration."
      );
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

  return (
    <main className="min-h-screen bg-slate-50 p-6 lg:p-10">
      <h1 className="text-4xl font-semibold text-slate-950">Integrations</h1>
      <p className="mt-2 text-lg text-slate-500">
        Connect external calendars to keep your reservations in sync.
      </p>

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {actionMessage && (
        <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-700">
          {actionMessage}
        </div>
      )}

      {loading ? (
        <div className="mt-10 text-slate-500">Loading integrations...</div>
      ) : (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {PROVIDERS.map((provider) => {
            const integration = integrationFor(provider.id);

            return (
              <div
                key={provider.id}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">
                      {provider.label}
                    </h2>
                    {integration?.accountName && (
                      <p className="mt-1 text-sm text-slate-500">
                        {integration.accountName}
                      </p>
                    )}
                  </div>

                  {integration ? (
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${statusClasses(integration.status)}`}
                    >
                      {integration.status}
                    </span>
                  ) : (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
                      Not configured
                    </span>
                  )}
                </div>

                {!provider.supported && (
                  <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
                    Coming soon — no working connection is available for this
                    provider yet.
                  </p>
                )}

                {provider.supported && (
                  <>
                    <div className="mt-4 space-y-1 text-sm text-slate-500">
                      <p>Last sync: {formatDateTime(integration?.lastSyncAt ?? null)}</p>
                      <p>
                        Last successful sync:{" "}
                        {formatDateTime(integration?.lastSuccessfulSyncAt ?? null)}
                      </p>
                    </div>

                    {canManage && (
                      <div className="mt-5 flex flex-wrap gap-2">
                        <button
                          onClick={() => {
                            setConfiguring({ provider: provider.id });
                            setFeedUrl("");
                            setAccountName(integration?.accountName ?? "");
                          }}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          {integration ? "Edit Configuration" : "Configure"}
                        </button>

                        {integration && (
                          <>
                            <button
                              onClick={() => handleToggle(integration)}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              {integration.status === "disabled" ? "Enable" : "Disable"}
                            </button>

                            <button
                              onClick={() => handleTest(integration)}
                              disabled={!integration.hasFeedConfigured}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                              Test Connection
                            </button>

                            <button
                              onClick={() => openHistory(integration)}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Sync History
                            </button>

                            <button
                              onClick={() => handleDelete(integration)}
                              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                            >
                              Remove
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {canManage && integration?.hasFeedConfigured && (
                      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                        <select
                          value={syncPropertyByIntegration[integration.id] ?? ""}
                          onChange={(event) =>
                            setSyncPropertyByIntegration((current) => ({
                              ...current,
                              [integration.id]: event.target.value,
                            }))
                          }
                          className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                        >
                          <option value="">Sync into property...</option>
                          {properties.map((property) => (
                            <option key={property.id} value={property.id}>
                              {property.title}
                            </option>
                          ))}
                        </select>

                        <button
                          onClick={() => handleSync(integration)}
                          disabled={syncingId === integration.id}
                          className="rounded-lg bg-[#10172a] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#18213a] disabled:opacity-50"
                        >
                          {syncingId === integration.id ? "Syncing..." : "Sync Now"}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Configuration modal */}
      {configuring && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                Configure {configuring.provider}
              </h3>
              <button
                onClick={() => setConfiguring(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <input
                type="text"
                value={accountName}
                onChange={(event) => setAccountName(event.target.value)}
                placeholder="Label (optional, e.g. property name)"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />

              <input
                type="text"
                value={feedUrl}
                onChange={(event) => setFeedUrl(event.target.value)}
                placeholder="iCal feed URL (https://...)"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />

              <button
                onClick={handleSaveConfiguration}
                disabled={saving}
                className="w-full rounded-xl bg-[#10172a] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#18213a] disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync history modal */}
      {historyFor && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                Sync History — {historyFor.provider}
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
                          {log.status}
                        </span>
                        <span className="text-xs text-slate-400">
                          {formatDateTime(log.syncedAt)}
                        </span>
                      </div>

                      {log.status === "success" ? (
                        <p className="mt-1 text-xs text-slate-500">
                          Imported {log.imported} · Updated {log.updated} ·
                          Cancelled {log.cancelled} · Skipped {log.skipped} ·
                          Conflicts {log.conflicts}
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
