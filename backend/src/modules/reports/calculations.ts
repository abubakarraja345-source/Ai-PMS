import {
  ReservationAnalyticsRow,
  OccupancyReservationRow,
  PropertyRow,
  GuestAnalyticsRow,
  CleaningAnalyticsRow,
  MaintenanceAnalyticsRow,
} from "./repository";
import {
  CurrencyAmount,
  CurrencyValue,
  CountBucket,
  TrendPoint,
  RevenueTrendPoint,
  OccupancyResult,
} from "./types";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return round2(
    values.reduce((sum, v) => sum + v, 0) / values.length
  );
}

export function sum(values: number[]): number {
  return round2(values.reduce((s, v) => s + v, 0));
}

/**
 * Reservations that actually generate revenue for these
 * approved rules: confirmed + completed only. Shared by
 * revenue, ADR, average length of stay, and lead time so all
 * four numbers describe the same underlying population.
 */
export function materializedReservations(
  reservations: ReservationAnalyticsRow[]
): ReservationAnalyticsRow[] {
  return reservations.filter(
    (r) => r.status === "confirmed" || r.status === "completed"
  );
}

export function daysBetweenDateStrings(
  start: string,
  end: string
): number {
  const startTs = Date.parse(`${start}T00:00:00Z`);
  const endTs = Date.parse(`${end}T00:00:00Z`);
  return Math.round((endTs - startTs) / MS_PER_DAY);
}

/**
 * Trend granularity heuristic: keeps charts readable regardless
 * of how wide a range the user picks.
 */
export function getBucketGranularity(
  start: string,
  end: string
): "day" | "week" | "month" {
  const days = daysBetweenDateStrings(start, end);
  if (days <= 31) return "day";
  if (days <= 180) return "week";
  return "month";
}

/**
 * Buckets a YYYY-MM-DD (or a timestamp's date portion) into its
 * trend key for the given granularity. Week buckets use the
 * Monday of that ISO week as the key.
 */
export function getBucketKey(
  dateStr: string,
  granularity: "day" | "week" | "month"
): string {
  const dateOnly = dateStr.slice(0, 10);

  if (granularity === "day") {
    return dateOnly;
  }

  if (granularity === "month") {
    return dateOnly.slice(0, 7);
  }

  const d = new Date(`${dateOnly}T00:00:00Z`);
  const day = d.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  return d.toISOString().slice(0, 10);
}

export function countBy<T>(
  items: T[],
  keyFn: (item: T) => string | null
): CountBucket[] {
  const map = new Map<string, number>();

  for (const item of items) {
    const key = keyFn(item) ?? "unspecified";
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

export function bucketCounts<T>(
  items: T[],
  dateFn: (item: T) => string,
  granularity: "day" | "week" | "month"
): TrendPoint[] {
  const map = new Map<string, number>();

  for (const item of items) {
    const key = getBucketKey(dateFn(item), granularity);
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  return Array.from(map.entries())
    .map(([bucket, count]) => ({ bucket, count }))
    .sort((a, b) => a.bucket.localeCompare(b.bucket));
}

/**
 * Revenue grouped by currency. Never blended across currencies
 * — approved rule. Rows with a null total_amount are excluded
 * (nothing to attribute).
 */
export function revenueByCurrency(
  reservations: ReservationAnalyticsRow[]
): CurrencyAmount[] {
  const map = new Map<string, { total: number; count: number }>();

  for (const r of reservations) {
    if (r.total_amount === null) continue;

    const currency = r.currency ?? "USD";
    const existing = map.get(currency) ?? {
      total: 0,
      count: 0,
    };

    existing.total += r.total_amount;
    existing.count += 1;

    map.set(currency, existing);
  }

  return Array.from(map.entries())
    .map(([currency, { total, count }]) => ({
      currency,
      total: round2(total),
      count,
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

/**
 * Revenue trend, bucketed by check-in date's bucket and grouped
 * by currency within each bucket — a currency is never summed
 * with another, even within the same time bucket.
 */
export function revenueTrend(
  reservations: ReservationAnalyticsRow[],
  granularity: "day" | "week" | "month"
): RevenueTrendPoint[] {
  const map = new Map<
    string,
    Map<string, { total: number; count: number }>
  >();

  for (const r of reservations) {
    if (r.total_amount === null) continue;

    const bucket = getBucketKey(r.check_in, granularity);
    const currency = r.currency ?? "USD";

    if (!map.has(bucket)) {
      map.set(bucket, new Map());
    }

    const byCurrency = map.get(bucket)!;
    const existing = byCurrency.get(currency) ?? {
      total: 0,
      count: 0,
    };

    existing.total += r.total_amount;
    existing.count += 1;

    byCurrency.set(currency, existing);
  }

  const points: RevenueTrendPoint[] = [];

  for (const [bucket, byCurrency] of map.entries()) {
    for (const [currency, { total, count }] of byCurrency.entries()) {
      points.push({
        bucket,
        currency,
        total: round2(total),
        count,
      });
    }
  }

  return points.sort(
    (a, b) =>
      a.bucket.localeCompare(b.bucket) ||
      a.currency.localeCompare(b.currency)
  );
}

/**
 * ADR (average daily rate) per currency = total revenue ÷ total
 * nights sold, within that currency. This is the standard
 * revenue-weighted definition, not a simple per-reservation
 * average. Reservations with no nights or no amount are
 * excluded from both the numerator and denominator.
 */
export function adrByCurrency(
  reservations: ReservationAnalyticsRow[]
): CurrencyValue[] {
  const map = new Map<
    string,
    { revenueSum: number; nightsSum: number }
  >();

  for (const r of reservations) {
    if (
      r.total_amount === null ||
      r.nights === null ||
      r.nights <= 0
    ) {
      continue;
    }

    const currency = r.currency ?? "USD";
    const existing = map.get(currency) ?? {
      revenueSum: 0,
      nightsSum: 0,
    };

    existing.revenueSum += r.total_amount;
    existing.nightsSum += r.nights;

    map.set(currency, existing);
  }

  return Array.from(map.entries())
    .map(([currency, { revenueSum, nightsSum }]) => ({
      currency,
      value:
        nightsSum > 0 ? round2(revenueSum / nightsSum) : 0,
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

export function cancellationRate(
  reservations: ReservationAnalyticsRow[]
): number {
  if (reservations.length === 0) return 0;

  const cancelled = reservations.filter(
    (r) => r.status === "cancelled"
  ).length;

  return round2((cancelled / reservations.length) * 100);
}

/**
 * Average days between booking creation and check-in.
 * Excludes reservations with a negative lead time (a data
 * anomaly — booked after the stay already started) rather than
 * letting them skew the average.
 */
export function averageLeadTimeDays(
  reservations: ReservationAnalyticsRow[]
): number | null {
  const values: number[] = [];

  for (const r of reservations) {
    const createdDate = r.created_at.slice(0, 10);
    const days = daysBetweenDateStrings(createdDate, r.check_in);

    if (days >= 0) {
      values.push(days);
    }
  }

  return average(values);
}

/**
 * Range-based occupancy: occupied-nights ÷ available-nights
 * over [start, end).
 *
 * - occupiedNights = sum, across qualifying reservations, of
 *   how many nights of THAT reservation fall inside the period
 *   (clipped to the period boundary — a reservation that starts
 *   before `start` or ends after `end` only counts the nights
 *   actually within range).
 * - availableNights = propertyCount × number of days in the
 *   period (the approved denominator: active properties for
 *   portfolio-wide occupancy; the property's own contribution
 *   when called per-property).
 *
 * This sums clipped nights per reservation without merging
 * overlapping intervals per property. Double-booking prevention
 * isn't implemented elsewhere in this project (a known, already
 *-flagged gap) — if two reservations for the same property
 * overlap, this will count both, which can push the rate above
 * 100%. That's left visible rather than silently clamped, since
 * a rate over 100% is itself a useful signal that something
 * needs attention, not something to hide.
 */
export function computeOccupancy(
  reservations: OccupancyReservationRow[],
  propertyCount: number,
  start: string,
  end: string
): OccupancyResult {
  const periodStart = Date.parse(`${start}T00:00:00Z`);
  const periodEnd = Date.parse(`${end}T00:00:00Z`);
  const periodDays = Math.round(
    (periodEnd - periodStart) / MS_PER_DAY
  );

  let occupiedNights = 0;

  for (const r of reservations) {
    const checkIn = Date.parse(`${r.check_in}T00:00:00Z`);
    const checkOut = Date.parse(`${r.check_out}T00:00:00Z`);

    const clippedStart = Math.max(checkIn, periodStart);
    const clippedEnd = Math.min(checkOut, periodEnd);

    if (clippedEnd > clippedStart) {
      occupiedNights += Math.round(
        (clippedEnd - clippedStart) / MS_PER_DAY
      );
    }
  }

  const availableNights = propertyCount * periodDays;

  const occupancyRate =
    availableNights > 0
      ? Math.round(
          (occupiedNights / availableNights) * 1000
        ) / 10
      : 0;

  return { occupiedNights, availableNights, occupancyRate };
}

/**
 * Repeat-guest detection, scoped to the reservations in the
 * requested period (not an all-time lookup) — a guest_id
 * appearing more than once among reservations created in
 * [start, end) counts as a repeat guest for this report.
 */
export function computeRepeatGuests(
  reservations: ReservationAnalyticsRow[]
) {
  const countByGuest = new Map<string, number>();

  for (const r of reservations) {
    countByGuest.set(
      r.guest_id,
      (countByGuest.get(r.guest_id) ?? 0) + 1
    );
  }

  const uniqueGuestCount = countByGuest.size;

  const repeatGuestCount = Array.from(
    countByGuest.values()
  ).filter((count) => count > 1).length;

  const repeatGuestRate =
    uniqueGuestCount > 0
      ? round2(
          (repeatGuestCount / uniqueGuestCount) * 100
        )
      : 0;

  return { repeatGuestCount, repeatGuestRate, uniqueGuestCount };
}

export function vipProportion(
  guests: GuestAnalyticsRow[]
): number {
  if (guests.length === 0) return 0;

  const vipCount = guests.filter((g) => g.vip).length;

  return round2((vipCount / guests.length) * 100);
}

export function averageHoursBetween(
  items: { start: string | null; end: string | null }[]
): number | null {
  const values: number[] = [];

  for (const item of items) {
    if (!item.start || !item.end) continue;

    const startTs = Date.parse(item.start);
    const endTs = Date.parse(item.end);
    const hours = (endTs - startTs) / (1000 * 60 * 60);

    if (hours >= 0) {
      values.push(hours);
    }
  }

  return average(values);
}
