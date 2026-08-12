import { verifyProperty } from "../reservations/service";
import {
  createReservation,
  findReservationsByOrganizationInRange,
  updateReservation,
} from "../reservations/repository";
import { CreateReservationInput } from "../reservations/validation";

import {
  createSyncLogRow,
  findIntegrationById,
  updateIntegrationRow,
} from "./repository";

import {
  findOrCreatePlaceholderGuest,
  findReservationByExternalRef,
} from "./sync.repository";

import { getProviderAdapter } from "./providers/registry";
import {
  isSupportedProvider,
  ProviderId,
  providerToReservationSource,
} from "./providers/types";

import {
  notifyIntegrationSyncConflict,
  notifyIntegrationSyncFailed,
} from "../notifications/service";

import { SyncResult } from "./types";

/**
 * Runs a manual sync for one integration against ONE property,
 * chosen by the caller at sync time. The `integrations` table has
 * no persistent property_id column (flagged in the Phase B report),
 * so there is no way to store "this feed always means property X"
 * across syncs yet — for the manual-sync use case this is
 * sufficient and safe: the caller picks the property every time
 * they click "Sync Now", exactly like every other property-scoped
 * write in this app already requires a propertyId. Automatic/
 * scheduled sync (not in scope for Phase B) would need the
 * persistent link.
 */
export async function runManualSync(
  organizationId: string,
  integrationId: string,
  propertyId: string,
  userId: string
): Promise<SyncResult> {
  const integration = await findIntegrationById(organizationId, integrationId);

  if (!integration) {
    throw new Error("Integration not found");
  }

  // A disabled connection must not sync — "Disable" needs to actually
  // stop synchronization, not just be a status label. "error" is
  // deliberately still allowed to retry (that's how a failing feed
  // recovers), only "disabled" blocks.
  if (integration.status === "disabled") {
    throw new Error(
      "This connection is disabled. Enable it before syncing."
    );
  }

  if (!isSupportedProvider(integration.provider)) {
    throw new Error(`Unknown provider: ${integration.provider}`);
  }

  const adapter = getProviderAdapter(integration.provider as ProviderId);

  if (!adapter) {
    throw new Error(
      `${integration.provider} is not yet supported — no working adapter/credentials exist for this provider`
    );
  }

  if (!integration.api_key) {
    throw new Error("No feed URL configured for this integration");
  }

  const propertyExists = await verifyProperty(organizationId, propertyId);

  if (!propertyExists) {
    throw new Error("Property not found in your organization");
  }

  let events;

  try {
    events = await adapter.fetchEvents({ feedUrl: integration.api_key });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";

    await createSyncLogRow(integrationId, {
      event: "manual_sync",
      status: "failed",
      response: { errorMessage: message },
    });

    const wasAlreadyError = integration.status === "error";
    await updateIntegrationRow(organizationId, integrationId, { status: "error" });

    if (!wasAlreadyError) {
      await notifyIntegrationSyncFailed(organizationId, {
        provider: integration.provider,
        accountName: integration.account_name,
        errorMessage: message,
      });
    }

    throw new Error(message);
  }

  const sourceValue = providerToReservationSource(integration.provider);

  let imported = 0;
  let updated = 0;
  let cancelled = 0;
  let skipped = 0;
  let conflicts = 0;
  let placeholderGuestId: string | null = null;

  for (const event of events) {
    if (!event.checkIn || !event.checkOut || event.checkOut <= event.checkIn) {
      skipped++;
      continue;
    }

    const refKey = `ical:${integrationId}:${event.externalId}`;
    const existing = await findReservationByExternalRef(
      organizationId,
      propertyId,
      refKey
    );

    if (event.isCancelled) {
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
        existing.check_in !== event.checkIn ||
        existing.check_out !== event.checkOut;

      if (!datesChanged) {
        skipped++;
        continue;
      }

      const overlapping = await findReservationsByOrganizationInRange(
        organizationId,
        event.checkIn,
        event.checkOut,
        propertyId
      );
      const conflict = overlapping.some((r) => r.id !== existing.id);

      const nights = Math.round(
        (new Date(`${event.checkOut}T00:00:00Z`).getTime() -
          new Date(`${event.checkIn}T00:00:00Z`).getTime()) /
          (1000 * 60 * 60 * 24)
      );

      // A conflicting update is still applied — not skipped — and
      // flagged for staff review instead. The external calendar is
      // treated as probably correct (the OTA already prevents double-
      // booking on its own end); silently dropping the update would
      // risk this system losing track of a real, paying guest's
      // actual dates.
      await updateReservation(organizationId, existing.id, {
        check_in: event.checkIn,
        check_out: event.checkOut,
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

    // No existing match for this external event — check whether the
    // dates conflict with ANY existing reservation. A conflict no
    // longer blocks the import (see the comment above); it's created
    // anyway and flagged for review.
    const overlapping = await findReservationsByOrganizationInRange(
      organizationId,
      event.checkIn,
      event.checkOut,
      propertyId
    );

    const hasConflict = overlapping.length > 0;

    if (!placeholderGuestId) {
      placeholderGuestId = await findOrCreatePlaceholderGuest(
        organizationId,
        integrationId,
        integration.account_name || integration.provider
      );
    }

    const importInput: CreateReservationInput = {
      property_id: propertyId,
      guest_id: placeholderGuestId,
      booking_reference: refKey,
      source: sourceValue,
      status: "confirmed",
      check_in: event.checkIn,
      check_out: event.checkOut,
      special_requests: event.summary,
    };

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

  const response = { imported, updated, cancelled, skipped, conflicts };

  await createSyncLogRow(integrationId, {
    event: "manual_sync",
    status: "success",
    response,
  });

  await updateIntegrationRow(organizationId, integrationId, {
    status: "active",
  });

  if (conflicts > 0) {
    await notifyIntegrationSyncConflict(organizationId, {
      provider: integration.provider,
      accountName: integration.account_name,
      conflictCount: conflicts,
    });
  }

  return {
    status: "success",
    imported,
    updated,
    cancelled,
    skipped,
    conflicts,
    errorMessage: null,
  };
}
