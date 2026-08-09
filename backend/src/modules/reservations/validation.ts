export interface CreateReservationInput {
  property_id: string;
  guest_id: string;

  booking_reference?: string | null;
  source: string;
  status?: string | null;

  check_in: string;
  check_out: string;

  adults?: number | null;
  children?: number | null;
  infants?: number | null;
  pets?: number | null;

  total_amount?: number | null;
  cleaning_fee?: number | null;
  taxes?: number | null;

  currency?: string | null;

  special_requests?: string | null;
}

/**
 * Validate YYYY-MM-DD strictly.
 *
 * This prevents JavaScript Date from accepting malformed
 * values such as:
 * 272026-11-10
 */
function validateDate(
  value: unknown,
  fieldName: string
): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} date is required`);
  }

  const date = value.trim();

  // Must exactly match YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(
      `${fieldName} must be a valid date in YYYY-MM-DD format`
    );
  }

  const [year, month, day] = date
    .split("-")
    .map(Number);

  // Create UTC date to avoid timezone issues
  const parsed = new Date(
    Date.UTC(year, month - 1, day)
  );

  // Check that JavaScript did not normalize an invalid date
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

function validateNonNegativeNumber(
  value: unknown,
  fieldName: string,
  defaultValue: number
): number {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    throw new Error(
      `${fieldName} must be a valid number`
    );
  }

  if (value < 0) {
    throw new Error(
      `${fieldName} cannot be negative`
    );
  }

  return value;
}

export function validateCreateReservation(
  input: unknown
): CreateReservationInput {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid request body");
  }

  const data = input as Record<string, unknown>;

  // Property
  if (
    typeof data.property_id !== "string" ||
    !data.property_id.trim()
  ) {
    throw new Error("Property is required");
  }

  // Guest
  if (
    typeof data.guest_id !== "string" ||
    !data.guest_id.trim()
  ) {
    throw new Error("Guest is required");
  }

  // Source
  if (
    typeof data.source !== "string" ||
    !data.source.trim()
  ) {
    throw new Error(
      "Reservation source is required"
    );
  }

  // Dates
  const checkIn = validateDate(
    data.check_in,
    "Check-in"
  );

  const checkOut = validateDate(
    data.check_out,
    "Check-out"
  );

  // Compare actual calendar dates
  const checkInDate = new Date(
    `${checkIn}T00:00:00Z`
  );

  const checkOutDate = new Date(
    `${checkOut}T00:00:00Z`
  );

  if (checkOutDate <= checkInDate) {
    throw new Error(
      "Check-out date must be after check-in date"
    );
  }

  // Guest counts
  const adults = validateNonNegativeNumber(
    data.adults,
    "Adults",
    1
  );

  const children = validateNonNegativeNumber(
    data.children,
    "Children",
    0
  );

  const infants = validateNonNegativeNumber(
    data.infants,
    "Infants",
    0
  );

  const pets = validateNonNegativeNumber(
    data.pets,
    "Pets",
    0
  );

  // Financial values
  const totalAmount =
    data.total_amount === null ||
    data.total_amount === undefined
      ? null
      : validateNonNegativeNumber(
          data.total_amount,
          "Total amount",
          0
        );

  const cleaningFee = validateNonNegativeNumber(
    data.cleaning_fee,
    "Cleaning fee",
    0
  );

  const taxes = validateNonNegativeNumber(
    data.taxes,
    "Taxes",
    0
  );

  return {
    property_id: data.property_id.trim(),

    guest_id: data.guest_id.trim(),

    booking_reference:
      typeof data.booking_reference === "string"
        ? data.booking_reference.trim() || null
        : null,

    source: data.source.trim(),

    status:
      typeof data.status === "string"
        ? data.status.trim() || "confirmed"
        : "confirmed",

    check_in: checkIn,

    check_out: checkOut,

    adults,

    children,

    infants,

    pets,

    total_amount: totalAmount,

    cleaning_fee: cleaningFee,

    taxes,

    currency:
      typeof data.currency === "string"
        ? data.currency.trim() || "USD"
        : "USD",

    special_requests:
      typeof data.special_requests === "string"
        ? data.special_requests.trim() || null
        : null,
  };
}