"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface AirbnbApiStatus {
  configured: boolean;
  connected: boolean;
  usingMockAdapter: boolean;
  integrationId: string | null;
  accountName: string | null;
  status: string | null;
  health: "healthy" | "warning" | "error" | "disabled" | null;
  lastSyncAt: string | null;
  lastSuccessfulSyncAt: string | null;
  nextScheduledSyncAt: string | null;
  consecutiveFailureCount: number;
  listingCount: number;
}

interface AvailableListing {
  externalListingId: string;
  name: string;
  address: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  maxGuests: number | null;
  imported: boolean;
  mappedPropertyId: string | null;
}

interface MappedListing {
  id: string;
  property_id: string;
  external_listing_id: string;
  external_listing_name: string | null;
}

interface PropertyOption {
  id: string;
  title: string;
}

function formatRelative(value: string | null, futureLabel = "ago"): string {
  if (!value) return "Never";

  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.round(Math.abs(diffMs) / 60000);
  const suffix = diffMs >= 0 ? futureLabel : "from now";

  if (minutes < 1) return diffMs >= 0 ? "just now" : "due now";
  if (minutes < 60) return `${minutes} min ${suffix}`;

  const hours = Math.round(minutes / 60);
  return `${hours} hr ${suffix}`;
}

const HEALTH_LABELS: Record<string, string> = {
  healthy: "Healthy",
  warning: "Warning",
  error: "Sync Error",
  disabled: "Disabled",
};

const HEALTH_CLASSES: Record<string, string> = {
  healthy: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  error: "bg-red-50 text-red-700 border-red-200",
  disabled: "bg-slate-50 text-slate-600 border-slate-200",
};

interface AirbnbApiSectionProps {
  canManage: boolean;
  properties: PropertyOption[];
}

/**
 * The Airbnb Official API card — deliberately visually and
 * conceptually separate from the "iCal Calendar Connections" section
 * above it on the same page, so a user can never confuse "connected
 * via calendar feed" with "connected via Airbnb's actual API" (see
 * Phase 6A architecture report). Reuses this page's existing
 * canManage/properties data rather than re-fetching them.
 */
export default function AirbnbApiSection({
  canManage,
  properties,
}: AirbnbApiSectionProps) {
  const [status, setStatus] = useState<AirbnbApiStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const [showListings, setShowListings] = useState(false);
  const [listings, setListings] = useState<AvailableListing[]>([]);
  const [mappedListings, setMappedListings] = useState<MappedListing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [listingsError, setListingsError] = useState("");
  const [selectedProperty, setSelectedProperty] = useState<
    Record<string, string>
  >({});
  const [importingListingId, setImportingListingId] = useState<string | null>(
    null
  );

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await apiFetch("/api/integrations/airbnb/status");
      setStatus(response.data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load Airbnb API status."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Handles the redirect back from /integrations/airbnb/callback,
  // which stores the outcome in sessionStorage rather than a URL
  // param, so a page refresh here never re-submits a stale code.
  useEffect(() => {
    const result = sessionStorage.getItem("airbnb_api_callback_result");
    if (!result) return;

    sessionStorage.removeItem("airbnb_api_callback_result");

    if (result === "success") {
      setMessage("Airbnb connected successfully.");
      loadStatus();
    } else {
      setError(result);
    }
  }, [loadStatus]);

  async function handleConnect() {
    try {
      setConnecting(true);
      setError("");

      const response = await apiFetch("/api/integrations/airbnb/connect", {
        method: "POST",
      });

      window.location.href = response.data.authorizationUrl;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to start Airbnb connect."
      );
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!window.confirm("Disconnect Airbnb? Listing mappings will remain but syncing will stop.")) {
      return;
    }

    try {
      setDisconnecting(true);
      setError("");
      await apiFetch("/api/integrations/airbnb/disconnect", { method: "POST" });
      setMessage("Airbnb disconnected.");
      await loadStatus();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to disconnect Airbnb."
      );
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleSync() {
    try {
      setSyncing(true);
      setError("");
      const response = await apiFetch("/api/integrations/airbnb/sync", {
        method: "POST",
      });
      setMessage(
        `Sync complete — ${response.data.imported} imported, ${response.data.updated} updated, ${response.data.conflicts} flagged for review.`
      );
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  async function openListings() {
    setShowListings(true);
    setListingsError("");
    setListingsLoading(true);

    try {
      const [listingsResponse, mappedResponse] = await Promise.all([
        apiFetch("/api/integrations/airbnb/listings"),
        apiFetch("/api/integrations/airbnb/mapped-listings"),
      ]);

      setListings(listingsResponse.data ?? []);
      setMappedListings(mappedResponse.data ?? []);
    } catch (err) {
      setListingsError(
        err instanceof Error ? err.message : "Unable to load listings."
      );
    } finally {
      setListingsLoading(false);
    }
  }

  async function handleImport(listing: AvailableListing) {
    const propertyId = selectedProperty[listing.externalListingId];

    if (!propertyId) {
      setListingsError("Choose a property to map this listing to first.");
      return;
    }

    try {
      setImportingListingId(listing.externalListingId);
      setListingsError("");

      await apiFetch("/api/integrations/airbnb/listings/import", {
        method: "POST",
        body: JSON.stringify({
          externalListingId: listing.externalListingId,
          externalListingName: listing.name,
          propertyId,
        }),
      });

      await openListings();
      await loadStatus();
    } catch (err) {
      setListingsError(
        err instanceof Error ? err.message : "Unable to import listing."
      );
    } finally {
      setImportingListingId(null);
    }
  }

  async function handleUnmap(linkId: string) {
    try {
      setListingsError("");
      await apiFetch(`/api/integrations/airbnb/listings/${linkId}`, {
        method: "DELETE",
      });
      await openListings();
      await loadStatus();
    } catch (err) {
      setListingsError(
        err instanceof Error ? err.message : "Unable to unmap listing."
      );
    }
  }

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-100 px-6 py-4 md:flex-row md:items-center">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Airbnb — Official API
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Direct API connection (separate from the iCal feed above).
          </p>
        </div>

        {status?.usingMockAdapter && (
          <span className="inline-flex w-fit items-center rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700">
            Development mock adapter active
          </span>
        )}
      </div>

      <div className="px-6 py-5">
        {loading ? (
          <p className="text-sm text-slate-500">Loading Airbnb API status...</p>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : !status ? null : !status.connected ? (
          <div>
            {!status.configured ? (
              <p className="text-sm text-slate-500">
                Airbnb API credentials are not configured.
              </p>
            ) : (
              <p className="text-sm text-slate-500">
                Not connected. Connect your Airbnb account to import
                listings and sync reservations directly via Airbnb&apos;s
                API.
              </p>
            )}

            {canManage && status.configured && (
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="mt-4 inline-flex items-center justify-center rounded-lg bg-[#10172a] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#18213a] disabled:opacity-50"
              >
                {connecting ? "Redirecting..." : "Connect Airbnb"}
              </button>
            )}
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                Connected
              </span>

              {status.health && (
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${HEALTH_CLASSES[status.health]}`}
                >
                  {HEALTH_LABELS[status.health]}
                </span>
              )}

              <span className="text-sm text-slate-500">
                Account: {status.accountName ?? "Unknown"}
              </span>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-slate-400">Last sync</p>
                <p className="mt-0.5 text-sm text-slate-700">
                  {formatRelative(status.lastSuccessfulSyncAt)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Next sync</p>
                <p className="mt-0.5 text-sm text-slate-700">
                  {status.nextScheduledSyncAt
                    ? formatRelative(status.nextScheduledSyncAt, "ago")
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Listings mapped</p>
                <p className="mt-0.5 text-sm text-slate-700">
                  {status.listingCount}
                </p>
              </div>
            </div>

            {canManage && (
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={openListings}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Manage Listings
                </button>

                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {syncing ? "Syncing..." : "Sync Now"}
                </button>

                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {disconnecting ? "Disconnecting..." : "Disconnect"}
                </button>
              </div>
            )}
          </div>
        )}

        {message && (
          <div className="mt-4 flex items-start justify-between gap-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            <span>{message}</span>
            <button onClick={() => setMessage("")} className="font-medium">
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Listing import / mapping modal */}
      {showListings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b bg-white px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Airbnb Listings
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Map each Airbnb listing to a property in your portfolio.
                </p>
              </div>

              <button
                onClick={() => setShowListings(false)}
                className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              {listingsError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {listingsError}
                </div>
              )}

              {listingsLoading ? (
                <p className="text-sm text-slate-500">Loading listings...</p>
              ) : listings.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No listings found on this Airbnb account.
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-700">
                    {listings.length} listing{listings.length === 1 ? "" : "s"} found
                  </p>

                  {listings.map((listing) => (
                    <div
                      key={listing.externalListingId}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-slate-900">
                            {listing.name}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            Airbnb ID: {listing.externalListingId}
                          </p>
                          {listing.address && (
                            <p className="mt-1 text-xs text-slate-500">
                              {listing.address}
                            </p>
                          )}
                        </div>

                        {listing.imported ? (
                          <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                            Imported
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
                            Not imported
                          </span>
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {listing.imported ? (
                          <>
                            {(() => {
                              const mapping = mappedListings.find(
                                (m) =>
                                  m.external_listing_id ===
                                  listing.externalListingId
                              );
                              return mapping ? (
                                <button
                                  onClick={() => handleUnmap(mapping.id)}
                                  className="text-xs font-medium text-red-600 hover:text-red-700"
                                >
                                  Unmap
                                </button>
                              ) : null;
                            })()}
                          </>
                        ) : (
                          <>
                            <select
                              value={
                                selectedProperty[listing.externalListingId] ??
                                ""
                              }
                              onChange={(event) =>
                                setSelectedProperty((current) => ({
                                  ...current,
                                  [listing.externalListingId]:
                                    event.target.value,
                                }))
                              }
                              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                            >
                              <option value="">Map to existing property...</option>
                              {properties.map((property) => (
                                <option key={property.id} value={property.id}>
                                  {property.title}
                                </option>
                              ))}
                            </select>

                            <button
                              onClick={() => handleImport(listing)}
                              disabled={
                                importingListingId === listing.externalListingId
                              }
                              className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                            >
                              {importingListingId === listing.externalListingId
                                ? "Importing..."
                                : "Import"}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
