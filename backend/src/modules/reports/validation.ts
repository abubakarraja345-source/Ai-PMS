import { validateDate } from "../reservations/validation";

export interface ReportsQuery {
  start: string;
  end: string;
}

/**
 * Strict YYYY-MM-DD start/end, [start, end) exclusive-end
 * semantics — same convention Calendar/Reservations already
 * use. Reuses the existing validateDate rather than a new copy.
 */
export function validateReportsQuery(
  query: Record<string, unknown>
): ReportsQuery {
  const start = validateDate(query.start, "start");
  const end = validateDate(query.end, "end");

  const startTimestamp = new Date(
    `${start}T00:00:00Z`
  ).getTime();

  const endTimestamp = new Date(
    `${end}T00:00:00Z`
  ).getTime();

  if (endTimestamp <= startTimestamp) {
    throw new Error("end must be after start");
  }

  return { start, end };
}
