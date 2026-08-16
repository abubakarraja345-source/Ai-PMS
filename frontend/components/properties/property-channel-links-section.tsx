"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface ChannelLink {
  id: string;
  propertyId: string;
  provider: string;
  externalListingId: string;
  createdAt: string;
  updatedAt: string;
}

interface ConnectionStatus {
  status: string;
  lastSyncAt: string | null;
  propertyId: string | null;
}

function formatRelative(value: string | null): string | null {
  if (!value) return null;

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
 * Matches the exact provider vocabulary the backend already validates
 * against (see integrations/channelLinks.validation.ts's
 * isSupportedProvider) — the same list app/(dashboard)/integrations/
 * page.tsx already uses for its provider cards. "direct" is
 * deliberately omitted here: a direct booking has no external listing
 * to map, so it doesn't belong in a channel-mapping list.
 */
const MAPPABLE_PROVIDERS: { id: string; label: string }[] = [
  { id: "airbnb", label: "Airbnb" },
  { id: "booking.com", label: "Booking.com" },
  { id: "vrbo", label: "VRBO" },
  { id: "ical", label: "iCal / Other" },
];

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function PropertyChannelLinksSection({
  propertyId,
  canManage,
}: {
  propertyId: string;
  canManage: boolean;
}) {
  const [links, setLinks] = useState<ChannelLink[]>([]);
  const [connectionsByProvider, setConnectionsByProvider] = useState<
    Record<string, ConnectionStatus>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [listingIdInput, setListingIdInput] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [removingProvider, setRemovingProvider] = useState<string | null>(
    null
  );

  const loadLinks = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      // The channel-links API is organization-scoped (see
      // integrations/channelLinks.routes.ts) rather than nested under
      // a property — filtered down to this property client-side
      // rather than inventing a property-scoped variant of a working
      // endpoint.
      const response = await apiFetch("/api/integrations/channel-links");
      const all: ChannelLink[] = response.data ?? [];

      setLinks(all.filter((link) => link.propertyId === propertyId));

      // Live sync status per provider, sourced from the same
      // connections the /integrations page manages — not a second
      // mapping system, just a read of the existing one for this
      // property's context.
      const integrationsResponse = await apiFetch("/api/integrations");
      const byProvider: Record<string, ConnectionStatus> = {};

      for (const integration of integrationsResponse.data ?? []) {
        if (integration.propertyId === propertyId) {
          byProvider[integration.provider] = {
            status: integration.status,
            lastSyncAt: integration.lastSyncAt,
            propertyId: integration.propertyId,
          };
        }
      }

      setConnectionsByProvider(byProvider);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load channel mappings."
      );
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  function linkFor(provider: string) {
    return links.find((link) => link.provider === provider);
  }

  function startEdit(provider: string) {
    const existing = linkFor(provider);
    setEditingProvider(provider);
    setListingIdInput(existing?.externalListingId ?? "");
    setFormError("");
  }

  async function handleSave(provider: string) {
    const trimmed = listingIdInput.trim();

    if (!trimmed) {
      setFormError("Please enter a listing ID.");
      return;
    }

    if (trimmed.length > 200) {
      setFormError("Listing ID must be 200 characters or fewer.");
      return;
    }

    try {
      setSaving(true);
      setFormError("");

      const existing = linkFor(provider);

      // No PATCH exists for channel links (create/delete only, by
      // design — see channelLinks.routes.ts) — editing replaces the
      // mapping via delete-then-create rather than inventing a new
      // endpoint for a rarely-changed value.
      if (existing) {
        await apiFetch(`/api/integrations/channel-links/${existing.id}`, {
          method: "DELETE",
        });
      }

      await apiFetch("/api/integrations/channel-links", {
        method: "POST",
        body: JSON.stringify({
          propertyId,
          provider,
          externalListingId: trimmed,
        }),
      });

      setEditingProvider(null);
      setListingIdInput("");
      await loadLinks();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to save mapping."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(link: ChannelLink) {
    const confirmed = window.confirm(
      "Remove this channel mapping?\n\nThis will disconnect the property from this external listing mapping.\n\nCancel / Remove"
    );

    if (!confirmed) return;

    try {
      setRemovingProvider(link.provider);
      setError("");

      await apiFetch(`/api/integrations/channel-links/${link.id}`, {
        method: "DELETE",
      });

      setLinks((current) => current.filter((l) => l.id !== link.id));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to remove mapping."
      );
    } finally {
      setRemovingProvider(null);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Channel Connections
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Listing mapping and iCal calendar synchronization. This does
            not create a live Airbnb/Booking.com/VRBO API connection —
            only standard iCal calendar sync.
          </p>
        </div>

        <Link
          href="/integrations"
          className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-muted"
        >
          Manage Connections
        </Link>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-5 text-sm text-muted-foreground">
          Loading channel mappings...
        </div>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {MAPPABLE_PROVIDERS.map((provider) => {
            const link = linkFor(provider.id);
            const isEditing = editingProvider === provider.id;
            const isRemoving = removingProvider === provider.id;

            return (
              <div
                key={provider.id}
                className="rounded-xl border border-border p-4"
              >
                <div className="flex items-start justify-between">
                  <p className="font-medium text-foreground">
                    {provider.label}
                  </p>

                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                      link
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-border bg-muted text-muted-foreground"
                    }`}
                  >
                    {link ? "Mapped" : "Not mapped"}
                  </span>
                </div>

                {link && !isEditing && (
                  <div className="mt-3 space-y-1 text-sm">
                    <p className="text-muted-foreground">External Listing ID</p>
                    <p className="break-all font-medium text-foreground">
                      {link.externalListingId}
                    </p>
                    <p className="text-xs text-muted-foreground/80">
                      Mapped {formatDateTime(link.createdAt)}
                    </p>

                    {connectionsByProvider[provider.id] && (
                      <p className="mt-2 flex items-center gap-1.5 text-xs">
                        <span
                          className={
                            connectionsByProvider[provider.id].status ===
                            "active"
                              ? "text-emerald-600"
                              : connectionsByProvider[provider.id].status ===
                                  "error"
                                ? "text-red-600"
                                : "text-muted-foreground/80"
                          }
                        >
                          ●
                        </span>
                        <span className="text-muted-foreground">
                          {connectionsByProvider[provider.id].status ===
                          "active"
                            ? "Connected"
                            : connectionsByProvider[provider.id].status ===
                                "error"
                              ? "Connection error"
                              : "Disabled"}
                          {formatRelative(
                            connectionsByProvider[provider.id].lastSyncAt
                          ) &&
                            ` · Last sync: ${formatRelative(connectionsByProvider[provider.id].lastSyncAt)}`}
                        </span>
                      </p>
                    )}
                  </div>
                )}

                {!link && !isEditing && (
                  <p className="mt-3 text-sm text-muted-foreground/80">
                    Not connected
                  </p>
                )}

                {isEditing && (
                  <div className="mt-3 space-y-2">
                    <label
                      htmlFor={`listing-id-${provider.id}`}
                      className="block text-sm text-muted-foreground"
                    >
                      External Listing ID
                    </label>

                    <input
                      id={`listing-id-${provider.id}`}
                      type="text"
                      value={listingIdInput}
                      onChange={(e) => setListingIdInput(e.target.value)}
                      placeholder="e.g. 123456789"
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary"
                    />

                    {formError && (
                      <p className="text-xs text-red-600">{formError}</p>
                    )}

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => {
                          setEditingProvider(null);
                          setFormError("");
                        }}
                        disabled={saving}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-muted disabled:opacity-50"
                      >
                        Cancel
                      </button>

                      <button
                        onClick={() => handleSave(provider.id)}
                        disabled={saving}
                        className="rounded-lg bg-gradient-to-r from-primary to-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {saving ? "Saving..." : "Save Mapping"}
                      </button>
                    </div>
                  </div>
                )}

                {canManage && !isEditing && (
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => startEdit(provider.id)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-muted"
                    >
                      {link ? "Edit" : "Add Listing"}
                    </button>

                    {link && (
                      <button
                        onClick={() => handleRemove(link)}
                        disabled={isRemoving}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        {isRemoving ? "Removing..." : "Remove"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && !canManage && links.length === 0 && (
        <p className="mt-5 text-sm text-muted-foreground/80">
          No channel mappings yet.
        </p>
      )}
    </section>
  );
}
