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

export function validateCreateReservation(
  input: unknown
): CreateReservationInput {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid request body");
  }

  const data = input as Record<string, unknown>;

  if (
    typeof data.property_id !== "string" ||
    !data.property_id.trim()
  ) {
    throw new Error("Property is required");
  }

  if (
    typeof data.guest_id !== "string" ||
    !data.guest_id.trim()
  ) {
    throw new Error("Guest is required");
  }

  if (
    typeof data.source !== "string" ||
    !data.source.trim()
  ) {
    throw new Error("Reservation source is required");
  }

  if (
    typeof data.check_in !== "string" ||
    !data.check_in.trim()
  ) {
    throw new Error("Check-in date is required");
  }

  if (
    typeof data.check_out !== "string" ||
    !data.check_out.trim()
  ) {
    throw new Error("Check-out date is required");
  }

  if (data.check_out <= data.check_in) {
    throw new Error(
      "Check-out date must be after check-in date"
    );
  }

  return {
    property_id: data.property_id.trim(),
    guest_id: data.guest_id.trim(),

    booking_reference:
      typeof data.booking_reference === "string"
        ? data.booking_reference.trim()
        : null,

    source: data.source.trim(),

    status:
      typeof data.status === "string"
        ? data.status.trim()
        : "confirmed",

    check_in: data.check_in.trim(),
    check_out: data.check_out.trim(),

    adults:
      typeof data.adults === "number"
        ? data.adults
        : 1,

    children:
      typeof data.children === "number"
        ? data.children
        : 0,

    infants:
      typeof data.infants === "number"
        ? data.infants
        : 0,

    pets:
      typeof data.pets === "number"
        ? data.pets
        : 0,

    total_amount:
      typeof data.total_amount === "number"
        ? data.total_amount
        : null,

    cleaning_fee:
      typeof data.cleaning_fee === "number"
        ? data.cleaning_fee
        : 0,

    taxes:
      typeof data.taxes === "number"
        ? data.taxes
        : 0,

    currency:
      typeof data.currency === "string"
        ? data.currency.trim()
        : "USD",

    special_requests:
      typeof data.special_requests === "string"
        ? data.special_requests.trim()
        : null,
  };
}