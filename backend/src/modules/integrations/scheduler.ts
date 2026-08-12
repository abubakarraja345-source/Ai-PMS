import { findActiveConnectionsForSync } from "./repository";
import { runManualSync } from "./sync.service";
import { resolveSyncIntervalMinutes } from "./syncConfig";

/**
 * Global tick guard (distinct from syncLock.ts's per-integration
 * lock) — if one tick is still processing connections when the next
 * interval fires (only realistic with a very short configured
 * interval and many connections), the new tick is skipped entirely
 * rather than starting a second overlapping pass. Per-connection
 * overlap between a tick and a manual "Sync Now" is handled
 * separately by syncLock.ts inside runManualSync itself.
 */
let tickInProgress = false;
let timer: ReturnType<typeof setInterval> | null = null;

/** "system" is not a real Supabase user id — runManualSync's userId
 * parameter is accepted but never read anywhere in its body (verified
 * by inspection), so this is a safe, honest placeholder rather than
 * fabricating a real user identity for an unattended process. */
const SCHEDULER_USER_ID = "system-scheduler";

async function runTick(): Promise<void> {
  if (tickInProgress) {
    console.log("[ical-scheduler] previous tick still running — skipping this cycle");
    return;
  }

  tickInProgress = true;

  try {
    const connections = await findActiveConnectionsForSync();

    if (connections.length === 0) {
      return;
    }

    console.log(`[ical-scheduler] syncing ${connections.length} connection(s)`);

    for (const connection of connections) {
      if (!connection.property_id) continue; // narrows for TS; query already filters this

      try {
        await runManualSync(
          connection.organization_id,
          connection.id,
          connection.property_id,
          SCHEDULER_USER_ID,
          "scheduled"
        );
      } catch (error) {
        // A single failing feed must never stop the rest of the
        // batch or crash the process — runManualSync has already
        // recorded the failure (sync log, status, notification); this
        // is just process-level containment.
        console.error(
          `[ical-scheduler] sync failed for integration ${connection.id}:`,
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    }
  } catch (error) {
    console.error(
      "[ical-scheduler] tick failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
  } finally {
    tickInProgress = false;
  }
}

export interface IcalScheduler {
  stop: () => void;
}

/**
 * Starts the automatic iCal sync scheduler. Plain setInterval — no
 * job-queue/cron library exists in this project (checked: no
 * node-cron, no Bull/BullMQ, no Agenda in package.json), and adding
 * one for a single periodic task would be new infrastructure this
 * phase doesn't need.
 */
export function startIcalScheduler(): IcalScheduler {
  const intervalMinutes = resolveSyncIntervalMinutes();
  const intervalMs = intervalMinutes * 60 * 1000;

  console.log(
    `[ical-scheduler] starting — interval ${intervalMinutes} minute(s)`
  );

  timer = setInterval(() => {
    runTick().catch((error) => {
      // runTick already catches everything internally; this is an
      // unreachable last-resort guard so a scheduler bug can never
      // become an unhandled rejection that crashes the process.
      console.error("[ical-scheduler] unexpected tick error:", error);
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
