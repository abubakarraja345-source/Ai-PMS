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
  ProviderAdapter,
  ProviderId,
  providerToReservationSource,
} from "./providers/types";

import {
  notifyIntegrationSyncConflict,
  notifyIntegrationSyncEscalation,
  notifyIntegrationSyncFailed,
  notifyIntegrationSyncRecovered,
} from "../notifications/service";

import { computeConnectionHealth } from "./health";
import { getEffectivePropertyCurrency } from "../properties/currency";
import { withIntegrationLock } from "./syncLock";
import { ConnectionHealth, SyncResult } from "./types";

export type SyncTrigger = "manual" | "scheduled";

/**
 * Transient failures (network blips, timeouts, unresolved DNS, 5xx
 * responses) are worth retrying a few times — the feed will likely
 * work on the next attempt with no user action needed. Permanent
 * failures (SSRF-blocked address, malformed/non-iCal content, 4xx
 * client errors, oversized feed) are never retried: retrying a feed
 * that's genuinely broken or blocked just delays the real error
 * uselessly, and retrying an SSRF rejection specifically must never
 * happen regardless of backoff — that would be a security bypass via
 * persistence, not a resilience feature.
 */
function isRetryableSyncError(message: string): boolean {
  const lower = message.toLowerCase();

  if (lower.includes("local or private address")) return false; // SSRF — never retry
  if (lower.includes("not valid")) return false; // malformed iCal / not a valid URL
  if (lower.includes("must use http or https")) return false;
  if (lower.includes("too large")) return false;

  if (lower.includes("timed out")) return true;
  if (lower.includes("could not be resolved")) return true;
  if (lower.includes("fetch failed")) return true;

  const statusMatch = lower.match(/status (\d\d\d)/);
  if (statusMatch && statusMatch[1]) {
    return statusMatch[1].startsWith("5");
  }

  // Unknown error shape — fail closed (don't retry something we can't
  // classify as safe to retry).
  return false;
}

const MAX_SYNC_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1000;

/**
 * Retries only the fetch+parse step, never anything after it — the
 * event-processing/conflict-detection loop below still runs exactly
 * once per successful fetch, so a retried sync can never produce
 * duplicate reservations (there is nothing to duplicate until a fetch
 * actually succeeds).
 */
async function fetchEventsWithRetry(
  adapter: ProviderAdapter,
  feedUrl: string
): Promise<Awaited<ReturnType<ProviderAdapter["fetchEvents"]>>> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_SYNC_ATTEMPTS; attempt++) {
    try {
      return await adapter.fetchEvents({ feedUrl });
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : "Sync failed";

      if (!isRetryableSyncError(message) || attempt === MAX_SYNC_ATTEMPTS) {
        throw error;
      }

      const delayMs = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // Unreachable (the loop always returns or throws), but keeps
  // TypeScript satisfied that every path returns/throws.
  throw lastError;
}

const ESCALATION_THRESHOLD = 5;

/**
 * Runs a sync for one integration against ONE property. `propertyId`
 * is normally the connection's own stored property_id (see
 * integrations/controller.ts, which defaults it there) — still an
 * explicit parameter rather than looked up internally, so this
 * function's contract doesn't silently change based on which caller
 * invokes it. `trigger` only affects the sync_logs.event label
 * ("manual_sync" vs "scheduled_sync") and defaults to "manual" so the
 * existing controller call site (predates this parameter) keeps
 * working unchanged.
 *
 * Wrapped in withIntegrationLock so a scheduler tick and a manual
 * "Sync Now" click for the SAME connection can never run this
 * function's fetch/parse/import loop concurrently — whichever call
 * arrives second simply waits for the first to finish.
 */
export async function runManualSync(
  organizationId: string,
  integrationId: string,
  propertyId: string,
  userId: string,
  trigger: SyncTrigger = "manual"
): Promise<SyncResult> {
  return withIntegrationLock(integrationId, () =>
    runSyncUnlocked(organizationId, integrationId, propertyId, trigger)
  );
}

async function runSyncUnlocked(
  organizationId: string,
  integrationId: string,
  propertyId: string,
  trigger: SyncTrigger
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

  // iCal feeds never reliably provide a transaction currency — this
  // is NOT invented from the feed. It's the same effective-currency
  // rule every other reservation in this app uses (property override,
  // else the organization's default), computed once per sync since it
  // doesn't vary per event.
  const importCurrency = await getEffectivePropertyCurrency(
    organizationId,
    propertyId
  );

  const eventLabel = trigger === "scheduled" ? "scheduled_sync" : "manual_sync";
  const startedAt = new Date();

  await updateIntegrationRow(organizationId, integrationId, {
    last_sync_started_at: startedAt.toISOString(),
  });

  let events;

  try {
    events = await fetchEventsWithRetry(adapter, integration.api_key);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    const durationMs = Date.now() - startedAt.getTime();

    await createSyncLogRow(integrationId, {
      event: eventLabel,
      status: "failed",
      response: { errorMessage: message },
      startedAt: startedAt.toISOString(),
      durationMs,
    });

    const wasAlreadyError = integration.status === "error";
    const failureCount = (integration.consecutive_failure_count ?? 0) + 1;

    await updateIntegrationRow(organizationId, integrationId, {
      status: "error",
      last_sync_duration_ms: durationMs,
      consecutive_failure_count: failureCount,
    });

    if (!wasAlreadyError) {
      await notifyIntegrationSyncFailed(organizationId, {
        provider: integration.provider,
        accountName: integration.account_name,
        errorMessage: message,
      });
    } else if (failureCount === ESCALATION_THRESHOLD) {
      await notifyIntegrationSyncEscalation(organizationId, {
        provider: integration.provider,
        accountName: integration.account_name,
        consecutiveFailureCount: failureCount,
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
      currency: importCurrency,
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
  const durationMs = Date.now() - startedAt.getTime();
  const completedAt = new Date();

  await createSyncLogRow(integrationId, {
    event: eventLabel,
    status: "success",
    response,
    startedAt: startedAt.toISOString(),
    durationMs,
  });

  const wasRecovering = (integration.consecutive_failure_count ?? 0) > 0;

  await updateIntegrationRow(organizationId, integrationId, {
    status: "active",
    last_sync_duration_ms: durationMs,
    consecutive_failure_count: 0,
  });

  if (wasRecovering) {
    await notifyIntegrationSyncRecovered(organizationId, {
      provider: integration.provider,
      accountName: integration.account_name,
    });
  }

  if (conflicts > 0) {
    await notifyIntegrationSyncConflict(organizationId, {
      provider: integration.provider,
      accountName: integration.account_name,
      conflictCount: conflicts,
    });
  }

  const health: ConnectionHealth = computeConnectionHealth({
    status: "active",
    consecutiveFailureCount: 0,
    lastSuccessfulSyncAt: completedAt.toISOString(),
  });

  return {
    status: "success",
    imported,
    updated,
    cancelled,
    skipped,
    conflicts,
    errorMessage: null,
    durationMs,
    health,
    lastSuccessfulSyncAt: completedAt.toISOString(),
  };
}
