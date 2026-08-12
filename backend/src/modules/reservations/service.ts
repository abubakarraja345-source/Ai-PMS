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
 * Non-blocking overlap check for the same property, excluding a
 * given reservation (used on edit, so a reservation never
 * "conflicts with itself") and cancelled reservations (which don't
 * occupy the property). This never prevents a save — double-
 * booking prevention was explicitly flagged earlier in this
 * project as an unresolved business-rule decision, so this only
 * surfaces the information for the UI to display, matching this
 * phase's "conflict detection" requirement without silently
 * changing existing create/update behavior.
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

  const reservation = await createReservation(
    organizationId,
    input
  );

  await notifyReservationCreated(organizationId, reservation);

  return reservation;
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
   * Update reservation.
   */
  const updated = await updateReservation(
    organizationId,
    reservationId,
    updates
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