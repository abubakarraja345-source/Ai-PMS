/**
 * Serializes async work per property within this Node process, closing
 * the classic "SELECT conflicts, then INSERT" race window for
 * concurrent reservation creation/editing against the same property.
 *
 * This is a promise-chaining mutex, not a database-level guarantee: it
 * only protects a single backend instance. The backend currently runs
 * as one local process (see AGENTS.md — "Backend remains LOCAL"), so
 * this closes the race completely for the current deployment. It would
 * NOT be sufficient if this backend were ever horizontally scaled to
 * multiple instances — that would require a database-level mechanism
 * (e.g. an EXCLUDE constraint or an advisory-lock-backed stored
 * procedure) instead. A real EXCLUDE constraint was evaluated for this
 * phase and rejected: live data already contains a pre-existing
 * overlapping reservation pair, and Postgres validates all existing
 * rows when an EXCLUDE constraint is added (no NOT VALID escape hatch
 * exists for exclusion constraints), so that migration would fail
 * outright against real data.
 */
const propertyQueues = new Map<string, Promise<unknown>>();

export function withPropertyLock<T>(
  propertyId: string,
  fn: () => Promise<T>
): Promise<T> {
  const previousTail = propertyQueues.get(propertyId) ?? Promise.resolve();

  const result = previousTail.then(fn, fn);

  // The queued tail must always resolve (never reject) so one failed
  // request doesn't wedge every subsequent request for this property —
  // only `result` (returned to this call's caller) carries the real
  // success/failure.
  const queueTail: Promise<void> = result.then(
    () => undefined,
    () => undefined
  );

  propertyQueues.set(propertyId, queueTail);

  queueTail.finally(() => {
    if (propertyQueues.get(propertyId) === queueTail) {
      propertyQueues.delete(propertyId);
    }
  });

  return result;
}
