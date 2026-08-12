import { supabase } from "../../config/supabase";
import {
  Reservation,
  ReservationListItem,
} from "./types";
import {
  CreateReservationInput,
  RESERVATION_STATUSES,
} from "./validation";

const RESERVATION_SELECT = `
  id,
  organization_id,
  property_id,
  guest_id,
  booking_reference,
  source,
  status,
  check_in,
  check_out,
  adults,
  children,
  infants,
  pets,
  nights,
  total_amount,
  cleaning_fee,
  taxes,
  currency,
  amount_base,
  base_currency,
  exchange_rate,
  special_requests,
  needs_review,
  created_at,
  updated_at,

  property:properties(
    id,
    title
  ),

  guest:guests(
    id,
    first_name,
    last_name,
    email
  )
`;

export interface ReservationListFilters {
  guestId?: string;
  propertyId?: string;
  status?: string;
  source?: string;
  search?: string;
  start?: string;
  end?: string;
  needsReview?: boolean;
}

/**
 * PostgREST's `.or()` takes a raw filter-grammar string that supabase-js
 * does not escape — commas and parentheses are structurally significant
 * (they separate conditions and delimit `in.(...)` lists), so a search
 * term containing them could otherwise break out of the intended filter.
 * None of those characters are meaningful in a booking reference, guest
 * name, or property title, so stripping them is a safe, fail-closed
 * sanitization rather than an attempt to reimplement PostgREST's quoting
 * rules.
 */
function sanitizeForOrFilter(term: string): string {
  return term.replace(/[,()]/g, "");
}

/**
 * Resolves which guest/property ids match the free-text search, so the
 * main reservations query can search across booking_reference/source
 * (its own columns) plus guest name/email and property title (columns
 * on joined tables, which PostgREST's `.or()` can't filter directly)
 * without needing an embedded-table filter.
 */
async function resolveSearchMatches(
  organizationId: string,
  search: string
): Promise<{ guestIds: string[]; propertyIds: string[] }> {
  const pattern = `%${sanitizeForOrFilter(search)}%`;

  const [guestsResult, propertiesResult] = await Promise.all([
    supabase
      .from("guests")
      .select("id")
      .eq("organization_id", organizationId)
      .or(
        `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`
      ),
    supabase
      .from("properties")
      .select("id")
      .eq("organization_id", organizationId)
      .ilike("title", pattern),
  ]);

  if (guestsResult.error) throw guestsResult.error;
  if (propertiesResult.error) throw propertiesResult.error;

  return {
    guestIds: (guestsResult.data ?? []).map((g) => g.id),
    propertyIds: (propertiesResult.data ?? []).map((p) => p.id),
  };
}

interface SearchMatches {
  guestIds: string[];
  propertyIds: string[];
}

interface FilterableQuery<Q> {
  eq(column: string, value: unknown): Q;
  gte(column: string, value: unknown): Q;
  lte(column: string, value: unknown): Q;
  or(filters: string): Q;
}

/**
 * Synchronous by design — `resolveSearchMatches` (the only part of
 * filtering that needs a network round-trip) is resolved once by the
 * caller and passed in, so this can build the filter chain in one
 * pass without an async function returning a thenable query builder
 * (which TypeScript/JS would otherwise flatten via `Promise` auto-
 * unwrapping, since the builder itself is PromiseLike).
 */
function applyListFilters<Q extends FilterableQuery<Q>>(
  organizationId: string,
  filters: ReservationListFilters,
  searchMatches: SearchMatches | null,
  query: Q
): Q {
  let scoped: Q = query.eq("organization_id", organizationId);

  if (filters.guestId) {
    scoped = scoped.eq("guest_id", filters.guestId);
  }

  if (filters.propertyId) {
    scoped = scoped.eq("property_id", filters.propertyId);
  }

  if (filters.status) {
    scoped = scoped.eq("status", filters.status);
  }

  if (filters.source) {
    scoped = scoped.eq("source", filters.source);
  }

  if (filters.start) {
    scoped = scoped.gte("check_in", filters.start);
  }

  if (filters.end) {
    scoped = scoped.lte("check_out", filters.end);
  }

  if (filters.needsReview) {
    scoped = scoped.eq("needs_review", true);
  }

  if (filters.search && searchMatches) {
    const term = sanitizeForOrFilter(filters.search);
    const orParts = [
      `booking_reference.ilike.%${term}%`,
      `source.ilike.%${term}%`,
    ];

    if (searchMatches.guestIds.length > 0) {
      orParts.push(`guest_id.in.(${searchMatches.guestIds.join(",")})`);
    }

    if (searchMatches.propertyIds.length > 0) {
      orParts.push(
        `property_id.in.(${searchMatches.propertyIds.join(",")})`
      );
    }

    scoped = scoped.or(orParts.join(","));
  }

  return scoped;
}

export async function findReservationsByOrganization(
  organizationId: string,
  filters: ReservationListFilters = {},
  range?: { from: number; to: number }
): Promise<{ data: ReservationListItem[]; total: number }> {
  const searchMatches = filters.search
    ? await resolveSearchMatches(organizationId, filters.search)
    : null;

  const base = supabase
    .from("reservations")
    .select(RESERVATION_SELECT, { count: "exact" });

  let query = applyListFilters(organizationId, filters, searchMatches, base);

  query = query.order("check_in", { ascending: true });

  if (range) {
    query = query.range(range.from, range.to);
  }

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  /*
   * Supabase's untyped client (no Database generic passed
   * to createClient) infers embedded relations as arrays by
   * default. At runtime PostgREST returns a single object
   * here because guest_id/property_id are many-to-one FKs —
   * this assertion aligns the type with actual behavior.
   */
  return {
    data: (data ?? []) as unknown as ReservationListItem[],
    total: count ?? 0,
  };
}

/**
 * Per-status counts for the reservations list's status tabs, honoring
 * every active filter except `status` itself (a tab's count reflects
 * how many reservations *would* show if that tab were selected, not
 * how many match the currently-selected one). `head: true` skips
 * fetching rows entirely — only the exact count is needed. The search
 * lookup is resolved once and reused across all four status queries
 * rather than repeating the guest/property name lookup per status.
 */
export async function findReservationStatusCounts(
  organizationId: string,
  filters: Omit<ReservationListFilters, "status">
): Promise<Record<string, number>> {
  const searchMatches = filters.search
    ? await resolveSearchMatches(organizationId, filters.search)
    : null;

  const counts = await Promise.all(
    RESERVATION_STATUSES.map(async (status) => {
      const base = supabase
        .from("reservations")
        .select("id", { count: "exact", head: true });

      const query = applyListFilters(
        organizationId,
        { ...filters, status },
        searchMatches,
        base
      );

      const { error, count } = await query;

      if (error) throw error;

      return [status, count ?? 0] as const;
    })
  );

  return Object.fromEntries(counts);
}

/**
 * Reservations overlapping [start, end) for calendar/availability
 * views. Checkout is treated as exclusive, matching how `nights`
 * is already computed elsewhere (the checkout day itself is not
 * occupied):
 *
 *   check_in < end AND check_out > start
 *
 * Cancelled reservations are excluded — they don't occupy the
 * property.
 */
export async function findReservationsByOrganizationInRange(
  organizationId: string,
  start: string,
  end: string,
  propertyId?: string
): Promise<ReservationListItem[]> {
  let query = supabase
    .from("reservations")
    .select(RESERVATION_SELECT)
    .eq("organization_id", organizationId)
    .neq("status", "cancelled")
    .lt("check_in", end)
    .gt("check_out", start)
    .order("check_in", {
      ascending: true,
    });

  if (propertyId) {
    query = query.eq("property_id", propertyId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as ReservationListItem[];
}

/**
 * Reservations that are either currently staying or still
 * upcoming, as of `fromDate` (inclusive). Drives the dashboard's
 * "today" section and upcoming-reservations list from a single
 * query instead of one query per metric.
 *
 * Only `confirmed`/`pending` reservations count — `cancelled`
 * never occupied the property, and `completed` reservations
 * checking out today/later would be a data inconsistency, not
 * something the dashboard should present as active.
 *
 * Bounded to `limit` rows (ordered by check_in ascending, so a
 * cap only ever drops the furthest-out reservations, not the
 * ones the dashboard actually needs).
 */
export async function findActiveAndUpcomingReservations(
  organizationId: string,
  fromDate: string,
  limit = 200
): Promise<ReservationListItem[]> {
  const { data, error } = await supabase
    .from("reservations")
    .select(RESERVATION_SELECT)
    .eq("organization_id", organizationId)
    .in("status", ["confirmed", "pending"])
    .gte("check_out", fromDate)
    .order("check_in", {
      ascending: true,
    })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as ReservationListItem[];
}

/**
 * Most recently created reservations, for the dashboard's
 * recent-activity feed. Includes every status — a cancellation
 * is still activity worth showing.
 */
export async function findRecentReservations(
  organizationId: string,
  limit = 5
): Promise<ReservationListItem[]> {
  const { data, error } = await supabase
    .from("reservations")
    .select(RESERVATION_SELECT)
    .eq("organization_id", organizationId)
    .order("created_at", {
      ascending: false,
    })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as ReservationListItem[];
}

export async function findReservationById(
  organizationId: string,
  reservationId: string
): Promise<Reservation | null> {
  const { data, error } = await supabase
    .from("reservations")
    .select(RESERVATION_SELECT)
    .eq("id", reservationId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as unknown as Reservation | null;
}

export async function createReservation(
  organizationId: string,
  input: CreateReservationInput
): Promise<Reservation> {
  const checkIn = new Date(input.check_in);
  const checkOut = new Date(input.check_out);

  const millisecondsPerDay =
    1000 * 60 * 60 * 24;

  const nights = Math.round(
    (checkOut.getTime() - checkIn.getTime()) /
      millisecondsPerDay
  );

  const { data, error } = await supabase
    .from("reservations")
    .insert({
      organization_id: organizationId,

      property_id: input.property_id,
      guest_id: input.guest_id,

      booking_reference:
        input.booking_reference,

      source: input.source,

      status:
        input.status ?? "confirmed",

      check_in: input.check_in,
      check_out: input.check_out,

      adults: input.adults ?? 1,
      children: input.children ?? 0,
      infants: input.infants ?? 0,
      pets: input.pets ?? 0,

      nights,

      total_amount:
        input.total_amount ?? null,

      cleaning_fee:
        input.cleaning_fee ?? 0,

      taxes:
        input.taxes ?? 0,

      currency:
        input.currency ?? "USD",

      amount_base: input.amount_base ?? null,
      base_currency: input.base_currency ?? null,
      exchange_rate: input.exchange_rate ?? null,

      special_requests:
        input.special_requests ?? null,
    })
    .select(RESERVATION_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return data as unknown as Reservation;
}

export async function updateReservation(
  organizationId: string,
  reservationId: string,
  updates: Record<string, unknown>
): Promise<Reservation | null> {
  const { data, error } = await supabase
    .from("reservations")
    .update(updates)
    .eq("id", reservationId)
    .eq("organization_id", organizationId)
    .select(RESERVATION_SELECT)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as unknown as Reservation | null;
}

export async function deleteReservation(
  organizationId: string,
  reservationId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("reservations")
    .delete()
    .eq("id", reservationId)
    .eq("organization_id", organizationId)
    .select("id");

  if (error) {
    throw error;
  }

  return !!data && data.length > 0;
}