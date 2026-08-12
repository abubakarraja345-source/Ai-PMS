import { isSupportedCurrency, SUPPORTED_CURRENCY_CODES } from "../../constants/currency";

export interface CreatePropertyInput {
  title: string;
  property_type: string;
  description?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  beds?: number | null;
  max_guests?: number | null;
  check_in_time?: string | null;
  check_out_time?: string | null;
  house_manual_url?: string | null;
  status?: string | null;
  currency?: string | null;
}

/**
 * NULL means "inherit the organization's default currency" (see
 * properties/currency.ts's getEffectivePropertyCurrency) — that's a
 * meaningful, intentional value here, not "not provided", so this
 * validates a non-null currency against the supported list but
 * passes null straight through.
 */
function validateOptionalCurrency(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string" || !value.trim()) {
    throw new Error("currency must be a string or null");
  }

  const currency = value.trim().toUpperCase();

  if (!isSupportedCurrency(currency)) {
    throw new Error(
      `currency must be one of: ${SUPPORTED_CURRENCY_CODES.join(", ")}`
    );
  }

  return currency;
}

export function validateCreateProperty(
  input: unknown
): CreatePropertyInput {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid request body");
  }

  const data = input as Record<string, unknown>;

  if (
    typeof data.title !== "string" ||
    !data.title.trim()
  ) {
    throw new Error("Property title is required");
  }

  if (
    typeof data.property_type !== "string" ||
    !data.property_type.trim()
  ) {
    throw new Error("Property type is required");
  }

  return {
    title: data.title.trim(),
    property_type: data.property_type.trim(),
    description:
      typeof data.description === "string"
        ? data.description
        : null,
    address:
      typeof data.address === "string"
        ? data.address
        : null,
    city:
      typeof data.city === "string"
        ? data.city
        : null,
    state:
      typeof data.state === "string"
        ? data.state
        : null,
    country:
      typeof data.country === "string"
        ? data.country
        : null,
    postal_code:
      typeof data.postal_code === "string"
        ? data.postal_code
        : null,
    latitude:
      typeof data.latitude === "number"
        ? data.latitude
        : null,
    longitude:
      typeof data.longitude === "number"
        ? data.longitude
        : null,
    bedrooms:
      typeof data.bedrooms === "number"
        ? data.bedrooms
        : null,
    bathrooms:
      typeof data.bathrooms === "number"
        ? data.bathrooms
        : null,
    beds:
      typeof data.beds === "number"
        ? data.beds
        : null,
    max_guests:
      typeof data.max_guests === "number"
        ? data.max_guests
        : null,
    check_in_time:
      typeof data.check_in_time === "string"
        ? data.check_in_time
        : null,
    check_out_time:
      typeof data.check_out_time === "string"
        ? data.check_out_time
        : null,
    house_manual_url:
      typeof data.house_manual_url === "string"
        ? data.house_manual_url
        : null,
    status:
      typeof data.status === "string"
        ? data.status
        : null,
    currency: validateOptionalCurrency(data.currency),
  };
}

function validateOptionalString(
  value: unknown,
  fieldName: string
): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string`);
  }

  return value;
}

function validateOptionalNumber(
  value: unknown,
  fieldName: string,
  allowNegative = false
): number | null {
  if (value === null) {
    return null;
  }

  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    throw new Error(
      `${fieldName} must be a valid number`
    );
  }

  if (!allowNegative && value < 0) {
    throw new Error(
      `${fieldName} cannot be negative`
    );
  }

  return value;
}

const UPDATE_STRING_FIELDS = [
  "description",
  "address",
  "city",
  "state",
  "country",
  "postal_code",
  "check_in_time",
  "check_out_time",
  "house_manual_url",
  "status",
] as const;

const UPDATE_NUMBER_FIELDS = [
  "bedrooms",
  "bathrooms",
  "beds",
  "max_guests",
] as const;

/**
 * Validates and allowlists PATCH fields for a property.
 *
 * Unlike CreatePropertyInput, every field is optional here,
 * but any field that IS supplied must have the correct type.
 * Only fields present on this allowlist are ever written —
 * this also prevents unexpected/protected keys from reaching
 * the database update.
 */
export function validateUpdateProperty(
  input: unknown
): Record<string, unknown> {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid request body");
  }

  const data = input as Record<string, unknown>;
  const updates: Record<string, unknown> = {};

  if (data.title !== undefined) {
    if (
      typeof data.title !== "string" ||
      !data.title.trim()
    ) {
      throw new Error(
        "Property title cannot be empty"
      );
    }

    updates.title = data.title.trim();
  }

  if (data.property_type !== undefined) {
    if (
      typeof data.property_type !== "string" ||
      !data.property_type.trim()
    ) {
      throw new Error(
        "Property type cannot be empty"
      );
    }

    updates.property_type = data.property_type.trim();
  }

  for (const field of UPDATE_STRING_FIELDS) {
    if (data[field] !== undefined) {
      updates[field] = validateOptionalString(
        data[field],
        field
      );
    }
  }

  for (const field of UPDATE_NUMBER_FIELDS) {
    if (data[field] !== undefined) {
      updates[field] = validateOptionalNumber(
        data[field],
        field
      );
    }
  }

  if (data.latitude !== undefined) {
    updates.latitude = validateOptionalNumber(
      data.latitude,
      "latitude",
      true
    );
  }

  if (data.longitude !== undefined) {
    updates.longitude = validateOptionalNumber(
      data.longitude,
      "longitude",
      true
    );
  }

  if (data.currency !== undefined) {
    updates.currency = validateOptionalCurrency(data.currency);
  }

  if (Object.keys(updates).length === 0) {
    throw new Error(
      "No valid fields provided to update"
    );
  }

  return updates;
}