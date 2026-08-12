import { getAirbnbApiAdapter } from "./registry";
import { isAirbnbApiConfigured } from "./adapter";
import { generateOAuthState, verifyOAuthState } from "./oauthState";
import { normalizeAirbnbReservation } from "./normalize";
import { AIRBNB_API_PROVIDER, AirbnbReservation, airbnbApiBookingReference } from "./types";

import {
  findAirbnbApiConnection,
  findAirbnbApiConnectionById,
  createAirbnbApiConnection,
  listAirbnbListingMappings,
  createAirbnbListingMapping,
  deleteAirbnbListingMapping,
  findOrCreateAirbnbPlaceholderGuest,
  AirbnbChannelLinkRow,
} from "./repository";

import {
  createSyncLogRow,
  updateIntegrationRow,
  findLastSuccessfulSyncLog,
} from "../repository";

import { computeConnectionHealth } from "../health";
import { withIntegrationLock } from "../syncLock";
import { resolveSyncIntervalMinutes } from "../syncConfig";
import { IntegrationRow, ConnectionHealth } from "../types";

import { verifyProperty } from "../../reservations/service";
import {
  createReservation,
  findReservationsByOrganizationInRange,
  updateReservation,
} from "../../reservations/repository";
import { findReservationByExternalRef } from "../sync.repository";
import { getEffectivePropertyCurrency } from "../../properties/currency";
import { createGuest } from "../../guests/repository";
import { logAudit } from "../../auditLog/service";

import {
  notifyIntegrationConnected,
  notifyIntegrationSyncConflict,
  notifyIntegrationSyncEscalation,
  notifyIntegrationSyncFailed,
  notifyIntegrationSyncRecovered,
} from "../../notifications/service";

export interface AuditActor {
  id: string;
  email?: string;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

const NOTIFICATION_LABEL = "Airbnb (Official API)";
const ESCALATION_THRESHOLD = 5;

/* --------------------------- Connection status --------------------------- */

export interface AirbnbApiStatus {
  /** True once real credentials OR the dev mock adapter are usable —
   * distinct from `connected`, which is whether this ORG has actually
   * authorized a connection yet. */
  configured: boolean;
  connected: boolean;
  usingMockAdapter: boolean;
  integrationId: string | null;
  accountName: string | null;
  status: string | null;
  health: ConnectionHealth | null;
  lastSyncAt: string | null;
  lastSuccessfulSyncAt: string | null;
  nextScheduledSyncAt: string | null;
  consecutiveFailureCount: number;
  listingCount: number;
}

export async function getConnectionStatus(
  organizationId: string
): Promise<AirbnbApiStatus> {
  const adapter = getAirbnbApiAdapter();
  const connection = await findAirbnbApiConnection(organizationId);
  const mappings = await listAirbnbListingMappings(organizationId);

  if (!connection) {
    return {
      configured: adapter.isMock || isAirbnbApiConfigured(),
      connected: false,
      usingMockAdapter: adapter.isMock,
      integrationId: null,
      accountName: null,
      status: null,
      health: null,
      lastSyncAt: null,
      lastSuccessfulSyncAt: null,
      nextScheduledSyncAt: null,
      consecutiveFailureCount: 0,
      listingCount: mappings.length,
    };
  }

  const lastSuccess = await findLastSuccessfulSyncLog(connection.id);

  const health = computeConnectionHealth({
    status: connection.status,
    consecutiveFailureCount: connection.consecutive_failure_count ?? 0,
    lastSuccessfulSyncAt: lastSuccess?.synced_at ?? null,
  });

  const nextScheduledSyncAt =
    connection.status !== "disabled"
      ? new Date(
          (lastSuccess?.synced_at
            ? new Date(lastSuccess.synced_at).getTime()
            : Date.now()) +
            resolveSyncIntervalMinutes() * 60 * 1000
        ).toISOString()
      : null;

  return {
    configured: true,
    // A disabled connection reads as "not connected" for UI purposes
    // (lets Connect Airbnb re-trigger a fresh authorization rather
    // than getting stuck showing a permanently "Connected (Disabled)"
    // card with no way back) — the row itself is kept, not deleted,
    // as a disconnect history trail; findAirbnbApiConnection always
    // resolves the most recently created row, so a later reconnect
    // naturally supersedes it.
    connected: connection.status !== "disabled",
    usingMockAdapter: adapter.isMock,
    integrationId: connection.id,
    accountName: connection.account_name,
    status: connection.status,
    health,
    lastSyncAt: connection.last_sync_started_at,
    lastSuccessfulSyncAt: lastSuccess?.synced_at ?? null,
    nextScheduledSyncAt,
    consecutiveFailureCount: connection.consecutive_failure_count ?? 0,
    listingCount: mappings.length,
  };
}

/* ------------------------------- OAuth flow ------------------------------- */

export async function startAuthorization(
  organizationId: string,
  actor: AuditActor
): Promise<{ authorizationUrl: string }> {
  const adapter = getAirbnbApiAdapter();

  if (!adapter.isMock && !isAirbnbApiConfigured()) {
    throw new Error(
      "Airbnb API credentials are not configured. Contact your administrator."
    );
  }

  const state = generateOAuthState(organizationId, actor.id);
  const authorizationUrl = adapter.getAuthorizationUrl(state);

  void logAudit({
    organizationId,
    actorUserId: actor.id,
    actorLabel: actor.email ?? actor.id,
    action: "airbnb.connection_started",
    entityType: "integration",
    entityId: null,
    metadata: { usingMockAdapter: adapter.isMock },
  });

  return { authorizationUrl };
}

export async function handleCallback(
  organizationId: string,
  actor: AuditActor,
  rawState: string,
  code: string
): Promise<IntegrationRow> {
  if (!verifyOAuthState(rawState, organizationId, actor.id)) {
    throw new Error(
      "Invalid or expired authorization state — please try connecting again."
    );
  }

  const adapter = getAirbnbApiAdapter();

  let tokenSet;

  try {
    tokenSet = await adapter.exchangeAuthorizationCode(code);
  } catch (error) {
    void logAudit({
      organizationId,
      actorUserId: actor.id,
      actorLabel: actor.email ?? actor.id,
      action: "airbnb.connection_failed",
      entityType: "integration",
      entityId: null,
      metadata: {
        reason: error instanceof Error ? error.message : "Unknown error",
      },
    });

    throw error;
  }

  const connection = await createAirbnbApiConnection(organizationId, {
    accountName: tokenSet.accountName,
    accessToken: tokenSet.accessToken,
    refreshToken: tokenSet.refreshToken,
    expiresAt: tokenSet.expiresAt,
  });

  void logAudit({
    organizationId,
    actorUserId: actor.id,
    actorLabel: actor.email ?? actor.id,
    action: "airbnb.connection_authorized",
    entityType: "integration",
    entityId: connection.id,
    metadata: { accountName: tokenSet.accountName },
  });

  await notifyIntegrationConnected(organizationId, {
    provider: NOTIFICATION_LABEL,
    accountName: tokenSet.accountName,
  });

  return connection;
}

export async function disconnectAirbnb(
  organizationId: string,
  actor: AuditActor
): Promise<boolean> {
  const connection = await findAirbnbApiConnection(organizationId);

  if (!connection) {
    return false;
  }

  const adapter = getAirbnbApiAdapter();

  try {
    if (connection.access_token) {
      await adapter.revoke(connection.access_token);
    }
  } catch {
    // Best-effort — proceed with local disconnect regardless of
    // whether the remote revoke call itself succeeded, matching how
    // the existing iCal "disable" action never depends on remote
    // acknowledgment either.
  }

  await updateIntegrationRow(organizationId, connection.id, {
    status: "disabled",
    access_token: null,
    refresh_token: null,
  });

  void logAudit({
    organizationId,
    actorUserId: actor.id,
    actorLabel: actor.email ?? actor.id,
    action: "airbnb.disconnected",
    entityType: "integration",
    entityId: connection.id,
    metadata: {},
  });

  return true;
}

/* ------------------------------ Listing import ------------------------------ */

export interface AvailableListing {
  externalListingId: string;
  name: string;
  address: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  maxGuests: number | null;
  imported: boolean;
  mappedPropertyId: string | null;
}

export async function listAvailableListings(
  organizationId: string
): Promise<AvailableListing[]> {
  const connection = await findAirbnbApiConnection(organizationId);

  if (!connection || !connection.access_token) {
    throw new Error("Airbnb is not connected for this organization.");
  }

  const adapter = getAirbnbApiAdapter();
  const [listings, mappings] = await Promise.all([
    adapter.getListings(connection.access_token),
    listAirbnbListingMappings(organizationId),
  ]);

  const mappingByListing = new Map(
    mappings.map((m) => [m.external_listing_id, m])
  );

  return listings.map((listing) => ({
    ...listing,
    imported: mappingByListing.has(listing.externalListingId),
    mappedPropertyId:
      mappingByListing.get(listing.externalListingId)?.property_id ?? null,
  }));
}

export async function listMappedListings(
  organizationId: string
): Promise<AirbnbChannelLinkRow[]> {
  return listAirbnbListingMappings(organizationId);
}

export async function importListing(
  organizationId: string,
  actor: AuditActor,
  input: {
    externalListingId: string;
    externalListingName: string | null;
    propertyId: string;
  }
): Promise<AirbnbChannelLinkRow> {
  const propertyExists = await verifyProperty(organizationId, input.propertyId);

  if (!propertyExists) {
    throw new Error("Property not found in your organization");
  }

  try {
    const mapping = await createAirbnbListingMapping(organizationId, {
      propertyId: input.propertyId,
      externalListingId: input.externalListingId,
      externalListingName: input.externalListingName,
    });

    void logAudit({
      organizationId,
      actorUserId: actor.id,
      actorLabel: actor.email ?? actor.id,
      action: "airbnb.listing_mapped",
      entityType: "property",
      entityId: input.propertyId,
      metadata: {
        externalListingId: input.externalListingId,
        externalListingName: input.externalListingName,
      },
    });

    return mapping;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Error(
        "This property is already mapped to an Airbnb listing, or this listing is already mapped to another property"
      );
    }

    throw error;
  }
}

export async function unmapListing(
  organizationId: string,
  actor: AuditActor,
  linkId: string
): Promise<boolean> {
  const deleted = await deleteAirbnbListingMapping(organizationId, linkId);

  if (deleted) {
    void logAudit({
      organizationId,
      actorUserId: actor.id,
      actorLabel: actor.email ?? actor.id,
      action: "airbnb.listing_unmapped",
      entityType: "property",
      entityId: linkId,
      metadata: {},
    });
  }

  return deleted;
}

/* --------------------------------- Sync --------------------------------- */

export interface AirbnbSyncResult {
  imported: number;
  updated: number;
  cancelled: number;
  skipped: number;
  conflicts: number;
}

export function syncAirbnbApiConnection(
  organizationId: string,
  integrationId: string,
  trigger: "manual" | "scheduled"
): Promise<AirbnbSyncResult> {
  return withIntegrationLock(integrationId, () =>
    runSyncUnlocked(organizationId, integrationId, trigger)
  );
}

async function resolveGuestForReservation(
  organizationId: string,
  integrationId: string,
  reservation: AirbnbReservation
): Promise<string> {
  if (reservation.guestName && reservation.guestName.trim()) {
    const parts = reservation.guestName.trim().split(/\s+/);
    const firstName = parts[0] ?? reservation.guestName.trim();
    const lastName = parts.slice(1).join(" ") || null;

    const guest = await createGuest(organizationId, {
      first_name: firstName,
      last_name: lastName,
      email: reservation.guestEmail,
      notes: `Imported from Airbnb API (integration ${integrationId})`,
    });

    return guest.id;
  }

  return findOrCreateAirbnbPlaceholderGuest(organizationId, integrationId);
}

/**
 * Mirrors integrations/sync.service.ts's runSyncUnlocked event
 * processing 1:1 (same dedup-via-booking_reference, same "import but
 * flag for review" conflict policy, same failure-count/health/
 * notification handling) — reusing the exact same conflict-detection
 * and reservation-repository calls, just fed by Airbnb API listings
 * across possibly many mapped properties per connection instead of
 * one iCal feed per property.
 */
async function runSyncUnlocked(
  organizationId: string,
  integrationId: string,
  trigger: "manual" | "scheduled"
): Promise<AirbnbSyncResult> {
  const connection = await findAirbnbApiConnectionById(
    organizationId,
    integrationId
  );

  if (!connection) {
    throw new Error("Airbnb connection not found");
  }

  if (connection.status === "disabled") {
    throw new Error("This connection is disabled. Enable it before syncing.");
  }

  if (!connection.access_token) {
    throw new Error("No access token configured for this connection.");
  }

  const mappings = await listAirbnbListingMappings(organizationId);
  const eventLabel = trigger === "scheduled" ? "scheduled_sync" : "manual_sync";
  const startedAt = new Date();
  const wasAlreadyError = connection.status === "error";

  await updateIntegrationRow(organizationId, integrationId, {
    last_sync_started_at: startedAt.toISOString(),
  });

  const adapter = getAirbnbApiAdapter();

  let imported = 0;
  let updated = 0;
  let cancelled = 0;
  let skipped = 0;
  let conflicts = 0;

  try {
    for (const mapping of mappings) {
      const propertyExists = await verifyProperty(
        organizationId,
        mapping.property_id
      );

      if (!propertyExists) {
        skipped++;
        continue;
      }

      const importCurrency = await getEffectivePropertyCurrency(
        organizationId,
        mapping.property_id
      );

      const reservations = await adapter.getReservations(
        connection.access_token,
        mapping.external_listing_id,
        null
      );

      for (const reservation of reservations) {
        if (
          !reservation.checkIn ||
          !reservation.checkOut ||
          reservation.checkOut <= reservation.checkIn
        ) {
          skipped++;
          continue;
        }

        const refKey = airbnbApiBookingReference(
          integrationId,
          reservation.externalReservationId
        );

        const existing = await findReservationByExternalRef(
          organizationId,
          mapping.property_id,
          refKey
        );

        if (reservation.status === "cancelled") {
          if (existing && existing.status !== "cancelled") {
            await updateReservation(organizationId, existing.id, {
              status: "cancelled",
            });
            cancelled++;
          } else {
            skipped++;
          }
          continue;
        }

        if (existing) {
          const datesChanged =
            existing.check_in !== reservation.checkIn ||
            existing.check_out !== reservation.checkOut;

          if (!datesChanged) {
            skipped++;
            continue;
          }

          const overlapping = await findReservationsByOrganizationInRange(
            organizationId,
            reservation.checkIn,
            reservation.checkOut,
            mapping.property_id
          );

          const conflict = overlapping.some((r) => r.id !== existing.id);

          const nights = Math.round(
            (new Date(`${reservation.checkOut}T00:00:00Z`).getTime() -
              new Date(`${reservation.checkIn}T00:00:00Z`).getTime()) /
              (1000 * 60 * 60 * 24)
          );

          await updateReservation(organizationId, existing.id, {
            check_in: reservation.checkIn,
            check_out: reservation.checkOut,
            nights,
            ...(conflict ? { needs_review: true } : {}),
          });

          if (conflict) {
            conflicts++;
          } else {
            updated++;
          }

          continue;
        }

        const overlapping = await findReservationsByOrganizationInRange(
          organizationId,
          reservation.checkIn,
          reservation.checkOut,
          mapping.property_id
        );

        const hasConflict = overlapping.length > 0;

        const guestId = await resolveGuestForReservation(
          organizationId,
          integrationId,
          reservation
        );

        const importInput = normalizeAirbnbReservation(
          reservation,
          integrationId,
          mapping.property_id,
          guestId
        );

        // createReservation (repository-level) never re-derives
        // currency the way addReservation (service-level) does —
        // set it explicitly here, exactly like the existing iCal sync
        // path does for the same reason (see sync.service.ts).
        importInput.currency = importCurrency;

        const created = await createReservation(organizationId, importInput);

        if (hasConflict) {
          await updateReservation(organizationId, created.id, {
            needs_review: true,
          });
          conflicts++;
        } else {
          imported++;
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    const durationMs = Date.now() - startedAt.getTime();
    const failureCount = (connection.consecutive_failure_count ?? 0) + 1;

    await createSyncLogRow(integrationId, {
      event: eventLabel,
      status: "failed",
      response: { errorMessage: message },
      startedAt: startedAt.toISOString(),
      durationMs,
    });

    await updateIntegrationRow(organizationId, integrationId, {
      status: "error",
      last_sync_duration_ms: durationMs,
      consecutive_failure_count: failureCount,
    });

    if (!wasAlreadyError) {
      await notifyIntegrationSyncFailed(organizationId, {
        provider: NOTIFICATION_LABEL,
        accountName: connection.account_name,
        errorMessage: message,
      });
    } else if (failureCount === ESCALATION_THRESHOLD) {
      await notifyIntegrationSyncEscalation(organizationId, {
        provider: NOTIFICATION_LABEL,
        accountName: connection.account_name,
        consecutiveFailureCount: failureCount,
      });
    }

    throw new Error(message);
  }

  const response = { imported, updated, cancelled, skipped, conflicts };
  const durationMs = Date.now() - startedAt.getTime();

  await createSyncLogRow(integrationId, {
    event: eventLabel,
    status: "success",
    response,
    startedAt: startedAt.toISOString(),
    durationMs,
  });

  const wasRecovering = (connection.consecutive_failure_count ?? 0) > 0;

  await updateIntegrationRow(organizationId, integrationId, {
    status: "active",
    last_sync_duration_ms: durationMs,
    consecutive_failure_count: 0,
  });

  if (wasRecovering) {
    await notifyIntegrationSyncRecovered(organizationId, {
      provider: NOTIFICATION_LABEL,
      accountName: connection.account_name,
    });
  }

  if (conflicts > 0) {
    await notifyIntegrationSyncConflict(organizationId, {
      provider: NOTIFICATION_LABEL,
      accountName: connection.account_name,
      conflictCount: conflicts,
    });
  }

  return response;
}

export { AIRBNB_API_PROVIDER };
