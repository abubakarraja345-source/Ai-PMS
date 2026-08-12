import { supabase } from "../../config/supabase";

import {
  createReservation,
  deleteReservation,
  findReservationById,
  findReservationsByOrganization,
  findReservationsByOrganizationInRange,
  findReservationStatusCounts,
  updateReservation,
} from "./repository";

import {
  CreateReservationInput,
  ReservationFilters,
  RESERVATION_SOURCES,
  RESERVATION_STATUSES,
} from "./validation";

import {
  notifyReservationCreated,
  notifyReservationStatusChanged,
} from "../notifications/service";

import { withPropertyLock } from "./propertyLock";
import { ReservationListItem } from "./types";

/**
 * Thrown when a create/edit would double-book a property. Carries a
 * client-safe, organization-scoped conflict payload so the route
 * handler can return the exact 409 shape this phase's spec requires,
 * distinct from every other thrown `Error` in this module (which the
 * routes render as a 400 with the raw message).
 */
export class ReservationConflictError extends Error {
  constructor(
    public readonly conflict: {
      propertyId: string;
      propertyName: string;
      conflictingReservationId: string;
      checkIn: string;
      checkOut: string;
      guestName: string;
    }
  ) {
    super("Property is already booked for these dates");
    this.name = "ReservationConflictError";
  }
}

export interface ConflictSummary {
  reservationId: string;
  checkIn: string;
  checkOut: string;
  guestName: string;
  status: string | null;
}

function guestNameOf(guest: ReservationListItem["guest"]): string {
  if (!guest) return "Guest";
  return `${guest.first_name} ${guest.last_name ?? ""}`.trim();
}

function toConflictSummary(r: ReservationListItem): ConflictSummary {
  return {
    reservationId: r.id,
    checkIn: r.check_in,
    checkOut: r.check_out,
    guestName: guestNameOf(r.guest),
    status: r.status,
  };
}

async function getPropertyTitle(
  organizationId: string,
  propertyId: string
): Promise<string> {
  const { data, error } = await supabase
    .from("properties")
    .select("title")
    .eq("id", propertyId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.title ?? "Property";
}

/**
 * Server-side availability check for a property/date range, backing
 * both the create/edit hard-block below and the public availability
 * API. Reuses the existing overlap query and existing
 * cancelled-reservations-don't-block rule (both already implemented
 * in repository.ts) rather than reimplementing overlap math.
 */
export async function checkPropertyAvailability(
  organizationId: string,
  propertyId: string,
  checkIn: string,
  checkOut: string,
  excludeReservationId?: string
): Promise<{ available: boolean; conflicts: ConflictSummary[] }> {
  const conflicts = await findConflictingReservations(
    organizationId,
    propertyId,
    checkIn,
    checkOut,
    excludeReservationId
  );

  return {
    available: conflicts.length === 0,
    conflicts: conflicts.map(toConflictSummary),
  };
}

async function assertAvailableOrThrow(
  organizationId: string,
  propertyId: string,
  checkIn: string,
  checkOut: string,
  excludeReservationId?: string
): Promise<void> {
  const { available, conflicts } = await checkPropertyAvailability(
    organizationId,
    propertyId,
    checkIn,
    checkOut,
    excludeReservationId
  );

  const first = conflicts[0];

  if (!available && first) {
    throw new ReservationConflictError({
      propertyId,
      propertyName: await getPropertyTitle(organizationId, propertyId),
      conflictingReservationId: first.reservationId,
      checkIn: first.checkIn,
      checkOut: first.checkOut,
      guestName: first.guestName,
    });
  }
}

export interface PropertyAvailabilityReport {
  available: boolean;
  propertyId: string;
  propertyName: string;
  start: string;
  end: string;
  conflicts: ConflictSummary[];
}

/**
 * Backs `GET /api/properties/:id/availability`. Verifies the property
 * belongs to the caller's organization first (throws the same
 * "not found in your organization" message every other property-
 * scoped write in this codebase already uses), so a cross-org caller
 * gets a clean 404 rather than ever seeing another organization's
 * reservation data.
 */
export async function getPropertyAvailabilityReport(
  organizationId: string,
  propertyId: string,
  start: string,
  end: string,
  excludeReservationId?: string
): Promise<PropertyAvailabilityReport> {
  const propertyExists = await verifyProperty(organizationId, propertyId);

  if (!propertyExists) {
    throw new Error("Property not found in your organization");
  }

  const [propertyName, availability] = await Promise.all([
    getPropertyTitle(organizationId, propertyId),
    checkPropertyAvailability(
      organizationId,
      propertyId,
      start,
      end,
      excludeReservationId
    ),
  ]);

  return {
    available: availability.available,
    propertyId,
    propertyName,
    start,
    end,
    conflicts: availability.conflicts,
  };
}

export async function getReservations(
  organizationId: string,
  filters: ReservationFilters,
  range: { from: number; to: number }
) {
  return findReservationsByOrganization(
    organizationId,
    filters,
    range
  );
}

/**
 * Status-tab counts, honoring every currently active filter except
 * status itself.
 */
export async function getReservationStatusCounts(
  organizationId: string,
  filters: Omit<ReservationFilters, "status">
) {
  return findReservationStatusCounts(organizationId, filters);
}

/**
 * Raw overlap query for the same property, excluding a given
 * reservation (used on edit, so a reservation never "conflicts with
 * itself") and cancelled reservations (which don't occupy the
 * property). Used both by `checkPropertyAvailability`/
 * `assertAvailableOrThrow` below (which DO block create/edit on a
 * real conflict) and by the reservations list route's informational,
 * non-blocking `conflictCount` on PATCH — the same query serves both
 * a hard gate and a soft informational surface depending on the
 * caller.
 */
export async function findConflictingReservations(
  organizationId: string,
  propertyId: string,
  checkIn: string,
  checkOut: string,
  excludeReservationId?: string
) {
  const overlapping = await findReservationsByOrganizationInRange(
    organizationId,
    checkIn,
    checkOut,
    propertyId
  );

  return overlapping.filter(
    (r) => r.id !== excludeReservationId
  );
}

export async function getReservation(
  organizationId: string,
  reservationId: string
) {
  return findReservationById(
    organizationId,
    reservationId
  );
}

/**
 * Verify that a property belongs to the user's organization.
 */
export async function verifyProperty(
  organizationId: string,
  propertyId: string
) {
  const { data, error } = await supabase
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return !!data;
}

/**
 * Verify that a guest belongs to the user's organization.
 */
async function verifyGuest(
  organizationId: string,
  guestId: string
) {
  const { data, error } = await supabase
    .from("guests")
    .select("id")
    .eq("id", guestId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return !!data;
}

/**
 * Strict YYYY-MM-DD validation.
 */
function validateDate(
  value: unknown,
  fieldName: string
): string {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new Error(
      `${fieldName} date is required`
    );
  }

  const date = value.trim();

  // Must be exactly YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(
      `${fieldName} must be a valid date in YYYY-MM-DD format`
    );
  }

  const [year, month, day] = date
    .split("-")
    .map(Number);

  // The regex above guarantees exactly 3 numeric segments,
  // but the array type can't express that statically.
  if (
    year === undefined ||
    month === undefined ||
    day === undefined
  ) {
    throw new Error(
      `${fieldName} must be a valid date in YYYY-MM-DD format`
    );
  }

  const parsed = new Date(
    Date.UTC(year, month - 1, day)
  );

  // Prevent invalid dates such as:
  // 2026-02-31
  // 2026-13-10
  // 2026-00-10
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(
      `${fieldName} must be a valid calendar date`
    );
  }

  return date;
}

/**
 * Convert YYYY-MM-DD into a UTC timestamp.
 */
function dateToTimestamp(
  date: string
) {
  return new Date(
    `${date}T00:00:00Z`
  ).getTime();
}

/**
 * Add or update a reservation.
 */
export async function addReservation(
  organizationId: string,
  input: CreateReservationInput
) {
  const propertyExists =
    await verifyProperty(
      organizationId,
      input.property_id
    );

  if (!propertyExists) {
    throw new Error(
      "Property not found in your organization"
    );
  }

  const guestExists =
    await verifyGuest(
      organizationId,
      input.guest_id
    );

  if (!guestExists) {
    throw new Error(
      "Guest not found in your organization"
    );
  }

  return withPropertyLock(input.property_id, async () => {
    // Serialized per-property (see propertyLock.ts) so this
    // check-then-insert can't race with another concurrent create for
    // the same property within this backend instance.
    await assertAvailableOrThrow(
      organizationId,
      input.property_id,
      input.check_in,
      input.check_out
    );

    const reservation = await createReservation(
      organizationId,
      input
    );

    // Defense-in-depth: re-verify after the write actually lands.
    // Under the current single-instance backend this should never find
    // anything (the lock above already serialized this property), but
    // it costs one cheap query and means a conflict is never silently
    // lost even if this backend were ever run as more than one
    // instance — it gets flagged for staff review via the same
    // existing needs_review workflow sync conflicts already use,
    // rather than either blocking here (too late — bookings often
    // shouldn't be prevented mid-race, per the same "import but flag"
    // policy already chosen for sync) or pretending no conflict
    // happened.
    const postInsertCheck = await checkPropertyAvailability(
      organizationId,
      input.property_id,
      input.check_in,
      input.check_out,
      reservation.id
    );

    if (!postInsertCheck.available) {
      const flagged = await updateReservation(
        organizationId,
        reservation.id,
        { needs_review: true }
      );

      if (flagged) {
        await notifyReservationCreated(organizationId, flagged);
        return flagged;
      }
    }

    await notifyReservationCreated(organizationId, reservation);

    return reservation;
  });
}

/**
 * Edit an existing reservation.
 *
 * Validates:
 * - property ownership
 * - guest ownership
 * - check-in date
 * - check-out date
 * - check-out > check-in
 * - recalculates nights when dates change
 */
export async function editReservation(
  organizationId: string,
  reservationId: string,
  updates: Record<string, unknown>
) {
  const existing =
    await findReservationById(
      organizationId,
      reservationId
    );

  if (!existing) {
    return null;
  }

  /*
   * PROPERTY VALIDATION
   */
  if (
    updates.property_id !== undefined
  ) {
    if (
      typeof updates.property_id !==
        "string" ||
      !updates.property_id.trim()
    ) {
      throw new Error(
        "Property is required"
      );
    }

    const propertyExists =
      await verifyProperty(
        organizationId,
        updates.property_id.trim()
      );

    if (!propertyExists) {
      throw new Error(
        "Property not found in your organization"
      );
    }

    updates.property_id =
      updates.property_id.trim();
  }

  /*
   * GUEST VALIDATION
   */
  if (
    updates.guest_id !== undefined
  ) {
    if (
      typeof updates.guest_id !==
        "string" ||
      !updates.guest_id.trim()
    ) {
      throw new Error(
        "Guest is required"
      );
    }

    const guestExists =
      await verifyGuest(
        organizationId,
        updates.guest_id.trim()
      );

    if (!guestExists) {
      throw new Error(
        "Guest not found in your organization"
      );
    }

    updates.guest_id =
      updates.guest_id.trim();
  }

  /*
   * DATE VALIDATION
   *
   * If only one date is being edited,
   * use the existing reservation's
   * other date.
   */

  let checkIn =
    existing.check_in;

  let checkOut =
    existing.check_out;

  if (
    updates.check_in !== undefined
  ) {
    checkIn = validateDate(
      updates.check_in,
      "Check-in"
    );

    updates.check_in = checkIn;
  }

  if (
    updates.check_out !== undefined
  ) {
    checkOut = validateDate(
      updates.check_out,
      "Check-out"
    );

    updates.check_out = checkOut;
  }

  /*
   * Make sure the final dates are valid.
   */
  const checkInTimestamp =
    dateToTimestamp(checkIn);

  const checkOutTimestamp =
    dateToTimestamp(checkOut);

  if (
    checkOutTimestamp <=
    checkInTimestamp
  ) {
    throw new Error(
      "Check-out date must be after check-in date"
    );
  }

  /*
   * Recalculate nights whenever
   * either date changes.
   */
  if (
    updates.check_in !== undefined ||
    updates.check_out !== undefined
  ) {
    const millisecondsPerDay =
      1000 * 60 * 60 * 24;

    const nights = Math.round(
      (
        checkOutTimestamp -
        checkInTimestamp
      ) / millisecondsPerDay
    );

    updates.nights = nights;
  }

  /*
   * Validate numeric guest counts
   * when supplied during editing.
   */
  const numericFields = [
    "adults",
    "children",
    "infants",
    "pets",
  ];

  for (const field of numericFields) {
    if (
      updates[field] !== undefined
    ) {
      const value =
        updates[field];

      if (
        typeof value !== "number" ||
        !Number.isFinite(value)
      ) {
        throw new Error(
          `${field} must be a valid number`
        );
      }

      if (value < 0) {
        throw new Error(
          `${field} cannot be negative`
        );
      }
    }
  }

  /*
   * Validate financial fields.
   */
  const moneyFields = [
    "total_amount",
    "cleaning_fee",
    "taxes",
  ];

  for (const field of moneyFields) {
    if (
      updates[field] !== undefined &&
      updates[field] !== null
    ) {
      const value =
        updates[field];

      if (
        typeof value !== "number" ||
        !Number.isFinite(value)
      ) {
        throw new Error(
          `${field} must be a valid number`
        );
      }

      if (value < 0) {
        throw new Error(
          `${field} cannot be negative`
        );
      }
    }
  }

  /*
   * Validate source, if supplied.
   */
  if (updates.source !== undefined) {
    if (
      typeof updates.source !== "string" ||
      !updates.source.trim()
    ) {
      throw new Error(
        "Reservation source is required"
      );
    }

    const source = updates.source.trim();

    if (
      !RESERVATION_SOURCES.includes(
        source as (typeof RESERVATION_SOURCES)[number]
      )
    ) {
      throw new Error(
        `Reservation source must be one of: ${RESERVATION_SOURCES.join(", ")}`
      );
    }

    updates.source = source;
  }

  /*
   * Validate status, if supplied.
   */
  if (
    updates.status !== undefined &&
    updates.status !== null
  ) {
    if (
      typeof updates.status !== "string" ||
      !RESERVATION_STATUSES.includes(
        updates.status.trim() as (typeof RESERVATION_STATUSES)[number]
      )
    ) {
      throw new Error(
        `Reservation status must be one of: ${RESERVATION_STATUSES.join(", ")}`
      );
    }

    updates.status = updates.status.trim();
  }

  /*
   * Prevent organization_id from being
   * modified through PATCH.
   */
  if (
    "organization_id" in updates
  ) {
    delete updates.organization_id;
  }

  /*
   * Prevent protected fields from
   * being changed by the client.
   */
  if ("id" in updates) {
    delete updates.id;
  }

  if ("created_at" in updates) {
    delete updates.created_at;
  }

  const statusChanged =
    updates.status !== undefined &&
    updates.status !== existing.status;

  /*
   * OVERLAP VALIDATION
   *
   * Only re-checked when the edit could actually change which dates
   * this reservation occupies: its own check-in/check-out, its
   * property, or reactivating it out of "cancelled" (which is the one
   * status transition that starts occupying the property again without
   * touching dates). Editing unrelated fields (guest count, price,
   * special requests, source, booking reference) never triggers this —
   * a reservation that already existed shouldn't suddenly fail to save
   * because some other, unrelated booking was created afterward.
   */
  const effectivePropertyId =
    (updates.property_id as string | undefined) ?? existing.property_id;

  const willBeCancelled =
    updates.status !== undefined
      ? updates.status === "cancelled"
      : existing.status === "cancelled";

  const reactivating =
    existing.status === "cancelled" && !willBeCancelled;

  const datesOrPropertyChanged =
    updates.check_in !== undefined ||
    updates.check_out !== undefined ||
    updates.property_id !== undefined;

  const shouldCheckAvailability =
    !willBeCancelled && (datesOrPropertyChanged || reactivating);

  /*
   * Update reservation. Serialized per-property (see propertyLock.ts)
   * alongside reservation creation, so an edit that reactivates or
   * moves a reservation can't race a concurrent create for the same
   * property.
   */
  const updated = await withPropertyLock(
    effectivePropertyId,
    async () => {
      if (shouldCheckAvailability) {
        await assertAvailableOrThrow(
          organizationId,
          effectivePropertyId,
          checkIn,
          checkOut,
          reservationId
        );
      }

      return updateReservation(
        organizationId,
        reservationId,
        updates
      );
    }
  );

  if (updated && statusChanged) {
    await notifyReservationStatusChanged(
      organizationId,
      updated,
      updated.status ?? String(updates.status)
    );
  }

  return updated;
}

/**
 * Delete reservation.
 */
export async function removeReservation(
  organizationId: string,
  reservationId: string
) {
  const existing =
    await findReservationById(
      organizationId,
      reservationId
    );

  if (!existing) {
    return false;
  }

  return deleteReservation(
    organizationId,
    reservationId
  );
}

/**
 * Clears needs_review after a staff member has looked at a
 * sync-flagged reservation (see integrations/sync.service.ts, which
 * is the only thing that ever sets this flag to true). Deliberately
 * its own narrow function rather than going through the general
 * editReservation path — needs_review must never be settable via the
 * general PATCH /api/reservations/:id body (see validation.ts's
 * allowlist, which does not include it), so clearing it needs its own
 * controlled entry point instead.
 */
export async function clearReviewFlag(
  organizationId: string,
  reservationId: string
) {
  const existing = await findReservationById(
    organizationId,
    reservationId
  );

  if (!existing) {
    return null;
  }

  return updateReservation(organizationId, reservationId, {
    needs_review: false,
  });
}