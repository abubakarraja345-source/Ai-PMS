import {
  createIntegrationRow,
  deleteIntegrationRow,
  deleteSyncLogsByIntegration,
  findIntegrationById,
  findIntegrationsByOrganization,
  findLastFailedSyncLog,
  findLastSuccessfulSyncLog,
  findLastSyncLog,
  updateIntegrationRow,
} from "./repository";

import { Integration, IntegrationRow } from "./types";
import { CreateIntegrationInput, UpdateIntegrationInput } from "./validation";
import { getProviderAdapter } from "./providers/registry";
import { isSupportedProvider, ProviderId } from "./providers/types";
import { icalAdapter } from "./providers/ical.adapter";
import {
  notifyIntegrationConnected,
  notifyIntegrationSyncFailed,
} from "../notifications/service";
import { verifyProperty } from "../reservations/service";
import { createChannelLink, removeChannelLink } from "./channelLinks.service";
import { ConnectPropertyCalendarInput } from "./validation";

async function toClientIntegration(row: IntegrationRow): Promise<Integration> {
  const [lastLog, lastSuccess, lastFailed] = await Promise.all([
    findLastSyncLog(row.id),
    findLastSuccessfulSyncLog(row.id),
    findLastFailedSyncLog(row.id),
  ]);

  const providerId = isSupportedProvider(row.provider) ? row.provider : null;
  const adapter = providerId ? getProviderAdapter(providerId) : null;

  const lastFailedResponse = (lastFailed?.response ?? null) as Record<
    string,
    unknown
  > | null;

  return {
    id: row.id,
    provider: row.provider,
    accountName: row.account_name,
    status: row.status,
    hasFeedConfigured: !!row.api_key,
    isSupported: !!adapter?.isSupported,
    createdAt: row.created_at,
    lastSyncAt: lastLog?.synced_at ?? null,
    lastSuccessfulSyncAt: lastSuccess?.synced_at ?? null,
    lastSyncError:
      typeof lastFailedResponse?.errorMessage === "string"
        ? lastFailedResponse.errorMessage
        : null,
    propertyId: row.property_id,
    propertyTitle: row.property?.title ?? null,
    externalListingName: row.external_listing_name,
  };
}

export async function listIntegrations(
  organizationId: string
): Promise<Integration[]> {
  const rows = await findIntegrationsByOrganization(organizationId);

  return Promise.all(rows.map(toClientIntegration));
}

export async function getIntegration(
  organizationId: string,
  integrationId: string
): Promise<Integration | null> {
  const row = await findIntegrationById(organizationId, integrationId);

  return row ? toClientIntegration(row) : null;
}

export async function addIntegration(
  organizationId: string,
  input: CreateIntegrationInput
): Promise<Integration> {
  const row = await createIntegrationRow(organizationId, input);

  return toClientIntegration(row);
}

/**
 * The full "Connect Calendar" flow (Phase E/G): verifies the property
 * belongs to this org, verifies the feed actually works (never saves
 * on a failed test — see PHASE F), registers the property<->listing
 * mapping through the existing, unmodified channel-links service (its
 * unique constraints are the single source of truth enforcing "one
 * external listing maps to exactly one property" — not reimplemented
 * here), then creates the connection itself already active.
 *
 * Not wrapped in a real database transaction (this codebase has no
 * stored procedures — see propertyLock.ts's equivalent note from the
 * reservations module); if the integration row fails to create after
 * the channel link already succeeded, the channel link is deleted as
 * a best-effort compensating action rather than left orphaned.
 */
export async function connectPropertyCalendar(
  organizationId: string,
  input: ConnectPropertyCalendarInput
): Promise<Integration> {
  const propertyExists = await verifyProperty(
    organizationId,
    input.propertyId
  );

  if (!propertyExists) {
    throw new Error("Property not found in your organization");
  }

  // Fetches + parses the real feed via the same adapter every sync
  // uses (including its SSRF guard) — a failed test never reaches the
  // create calls below.
  await icalAdapter.fetchEvents({ feedUrl: input.feedUrl });

  const link = await createChannelLink(organizationId, {
    propertyId: input.propertyId,
    provider: input.provider,
    externalListingId: input.externalListingId,
  });

  try {
    const row = await createIntegrationRow(organizationId, {
      provider: input.provider,
      accountName: null,
      feedUrl: input.feedUrl,
      propertyId: input.propertyId,
      externalListingName: input.externalListingName,
    });

    const activated = await updateIntegrationRow(organizationId, row.id, {
      status: "active",
    });

    await notifyIntegrationConnected(organizationId, {
      provider: input.provider,
      accountName: input.externalListingName,
    });

    return toClientIntegration(activated ?? row);
  } catch (error) {
    await removeChannelLink(organizationId, link.id).catch(() => undefined);
    throw error;
  }
}

export async function editIntegration(
  organizationId: string,
  integrationId: string,
  updates: UpdateIntegrationInput
): Promise<Integration | null> {
  const dbUpdates: Record<string, unknown> = {};

  if (updates.accountName !== undefined)
    dbUpdates.account_name = updates.accountName;
  if (updates.feedUrl !== undefined) dbUpdates.api_key = updates.feedUrl;
  if (updates.externalListingName !== undefined)
    dbUpdates.external_listing_name = updates.externalListingName;

  const updated = await updateIntegrationRow(
    organizationId,
    integrationId,
    dbUpdates
  );

  return updated ? toClientIntegration(updated) : null;
}

export async function removeIntegration(
  organizationId: string,
  integrationId: string
): Promise<boolean> {
  const existing = await findIntegrationById(organizationId, integrationId);

  if (!existing) {
    return false;
  }

  await deleteSyncLogsByIntegration(integrationId);

  return deleteIntegrationRow(organizationId, integrationId);
}

function assertAdapterAvailable(row: IntegrationRow) {
  if (!isSupportedProvider(row.provider)) {
    throw new Error(`Unknown provider: ${row.provider}`);
  }

  const adapter = getProviderAdapter(row.provider as ProviderId);

  if (!adapter) {
    throw new Error(
      `${row.provider} is not yet supported — no working adapter/credentials exist for this provider`
    );
  }

  return adapter;
}

export async function enableIntegration(
  organizationId: string,
  integrationId: string
): Promise<Integration | null> {
  const existing = await findIntegrationById(organizationId, integrationId);

  if (!existing) {
    return null;
  }

  assertAdapterAvailable(existing);

  if (!existing.api_key) {
    throw new Error("Configure a feed URL before enabling this integration");
  }

  const updated = await updateIntegrationRow(organizationId, integrationId, {
    status: "active",
  });

  return updated ? toClientIntegration(updated) : null;
}

export async function disableIntegration(
  organizationId: string,
  integrationId: string
): Promise<Integration | null> {
  const updated = await updateIntegrationRow(organizationId, integrationId, {
    status: "disabled",
  });

  return updated ? toClientIntegration(updated) : null;
}

export interface ConnectionTestResult {
  success: boolean;
  eventCount: number;
  errorMessage: string | null;
}

export interface IcalUrlTestResult {
  eventCount: number;
  sampleEvents: { checkIn: string; checkOut: string; summary: string | null }[];
  dateRange: { start: string; end: string } | null;
}

/**
 * "Test Connection" for the new connect-a-calendar flow (Phase E/F) —
 * fetches and parses a feed URL that hasn't been saved as an
 * integration yet, so the admin can verify it before committing to a
 * property mapping. Reuses the exact same icalAdapter.fetchEvents used
 * by every real sync (including its SSRF guard via
 * urlSafety.assertPublicHttpUrl) rather than writing a second parser.
 */
export async function testIcalFeedUrl(
  feedUrl: string
): Promise<IcalUrlTestResult> {
  const events = await icalAdapter.fetchEvents({ feedUrl });

  const sorted = [...events].sort((a, b) => (a.checkIn < b.checkIn ? -1 : 1));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const dateRange =
    first && last ? { start: first.checkIn, end: last.checkOut } : null;

  return {
    eventCount: events.length,
    sampleEvents: events.slice(0, 3).map((e) => ({
      checkIn: e.checkIn,
      checkOut: e.checkOut,
      summary: e.summary,
    })),
    dateRange,
  };
}

/**
 * Fetches and parses the configured feed without touching
 * reservations at all — safe to run regardless of whether this
 * integration is linked to a property.
 */
export async function testIntegrationConnection(
  organizationId: string,
  integrationId: string
): Promise<ConnectionTestResult> {
  const existing = await findIntegrationById(organizationId, integrationId);

  if (!existing) {
    throw new Error("Integration not found");
  }

  const adapter = assertAdapterAvailable(existing);

  if (!existing.api_key) {
    throw new Error("No feed URL configured");
  }

  const wasWorking = existing.status === "active";

  try {
    const events = await adapter.fetchEvents({ feedUrl: existing.api_key });

    await updateIntegrationRow(organizationId, integrationId, {
      status: "active",
    });

    if (!wasWorking) {
      await notifyIntegrationConnected(organizationId, {
        provider: existing.provider,
        accountName: existing.account_name,
      });
    }

    return { success: true, eventCount: events.length, errorMessage: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection failed";

    const wasAlreadyError = existing.status === "error";

    await updateIntegrationRow(organizationId, integrationId, {
      status: "error",
    });

    if (!wasAlreadyError) {
      await notifyIntegrationSyncFailed(organizationId, {
        provider: existing.provider,
        accountName: existing.account_name,
        errorMessage: message,
      });
    }

    return { success: false, eventCount: 0, errorMessage: message };
  }
}
