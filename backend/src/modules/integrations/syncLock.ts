/**
 * Serializes sync execution per integration within this Node process
 * — the same promise-chaining mutex pattern as
 * reservations/propertyLock.ts (kept as a separate, analogous file
 * rather than modifying that one, since it's a distinct lock domain
 * keyed by integration ID, not property ID).
 *
 * This closes the "scheduler tick + manual Sync Now for the same
 * connection running at once" race: whichever call arrives second
 * simply waits for the first to finish before it starts, so the
 * event-processing loop in sync.service.ts's runManualSync never runs
 * twice concurrently for the same integration.
 *
 * Process-local only — this protects a single backend instance. The
 * backend currently runs as one local process (see AGENTS.md —
 * "Backend remains LOCAL"), so this closes the race completely for
 * the current deployment. It would NOT be sufficient if this backend
 * were ever horizontally scaled to multiple instances; that would
 * require a database-level mechanism (e.g. an advisory lock) instead
 * — the same limitation already documented for propertyLock.ts.
 */
const integrationQueues = new Map<string, Promise<unknown>>();

export function withIntegrationLock<T>(
  integrationId: string,
  fn: () => Promise<T>
): Promise<T> {
  const previousTail = integrationQueues.get(integrationId) ?? Promise.resolve();

  const result = previousTail.then(fn, fn);

  const queueTail: Promise<void> = result.then(
    () => undefined,
    () => undefined
  );

  integrationQueues.set(integrationId, queueTail);

  queueTail.finally(() => {
    if (integrationQueues.get(integrationId) === queueTail) {
      integrationQueues.delete(integrationId);
    }
  });

  return result;
}
