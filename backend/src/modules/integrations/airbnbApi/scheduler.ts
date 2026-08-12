import { findActiveApiConnectionsForSync } from "./repository";
import { syncAirbnbApiConnection } from "./service";
import { resolveSyncIntervalMinutes } from "../syncConfig";

/**
 * The Airbnb Official API sibling of integrations/scheduler.ts — same
 * interval/lock/containment pattern, reusing the identical
 * resolveSyncIntervalMinutes config, deliberately NOT merged into that
 * file (see Phase 6A architecture report: "don't create another
 * scheduler" is read here as "don't invent different scheduling
 * infrastructure," not "must literally share one setInterval" — the
 * iCal scheduler's own query already structurally excludes
 * airbnb_api rows (it filters on api_key, which those rows never
 * set), so this is a fully independent, zero-overlap tick).
 */
let tickInProgress = false;
let timer: ReturnType<typeof setInterval> | null = null;

async function runTick(): Promise<void> {
  if (tickInProgress) {
    console.log(
      "[airbnb-api-scheduler] previous tick still running — skipping this cycle"
    );
    return;
  }

  tickInProgress = true;

  try {
    const connections = await findActiveApiConnectionsForSync();

    if (connections.length === 0) {
      return;
    }

    console.log(
      `[airbnb-api-scheduler] syncing ${connections.length} connection(s)`
    );

    for (const connection of connections) {
      try {
        await syncAirbnbApiConnection(
          connection.organization_id,
          connection.id,
          "scheduled"
        );
      } catch (error) {
        // A single failing connection must never stop the rest of the
        // batch or crash the process — syncAirbnbApiConnection has
        // already recorded the failure (sync log, status,
        // notification); this is just process-level containment,
        // identical to the iCal scheduler's own catch here.
        console.error(
          `[airbnb-api-scheduler] sync failed for integration ${connection.id}:`,
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    }
  } catch (error) {
    console.error(
      "[airbnb-api-scheduler] tick failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
  } finally {
    tickInProgress = false;
  }
}

export interface AirbnbApiScheduler {
  stop: () => void;
}

export function startAirbnbApiScheduler(): AirbnbApiScheduler {
  const intervalMinutes = resolveSyncIntervalMinutes();
  const intervalMs = intervalMinutes * 60 * 1000;

  console.log(
    `[airbnb-api-scheduler] starting — interval ${intervalMinutes} minute(s)`
  );

  timer = setInterval(() => {
    runTick().catch((error) => {
      console.error(
        "[airbnb-api-scheduler] unexpected tick error:",
        error
      );
    });
  }, intervalMs);

  return {
    stop: () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}
