import { isSupportedCurrency, SUPPORTED_CURRENCY_CODES } from "../../constants/currency";

export interface UpdateSettingsInput {
  name?: string;
  timezone?: string;
  currency?: string;
  language?: string;
  check_in_time?: string | null;
  check_out_time?: string | null;
  guest_message_template?: string | null;
  base_currency?: string | null;
  display_currency?: string | null;
  exchange_rate_mode?: "auto" | "manual";
}

/**
 * Fields that must be a non-empty string when supplied. No
 * enum/format is enforced for timezone — the rest of the codebase
 * (properties.check_in_time) never establishes an allowed-values
 * list for that kind of field either, so inventing one here would be
 * a new, unproven business rule. `currency` is the one exception —
 * this is now the organization's default currency (see
 * constants/currency.ts), and an unvalidated free-text currency code
 * would let a typo silently break every property/reservation that
 * inherits it, so it's validated separately below rather than
 * through this generic non-empty-string list.
 */
const REQUIRED_STRING_FIELDS = [
  "timezone",
  "language",
] as const;

/** Free-text fields that may be explicitly cleared with null. */
const NULLABLE_STRING_FIELDS = [
  "check_in_time",
  "check_out_time",
  "guest_message_template",
] as const;

/**
 * Validates and allowlists PATCH fields for organization settings.
 * Only fields on this allowlist are ever read from the request
 * body, so unknown/unapproved keys can never reach the database.
 */
export function validateUpdateSettings(
  input: unknown
): UpdateSettingsInput {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid request body");
  }

  const data = input as Record<string, unknown>;
  const updates: UpdateSettingsInput = {};

  if (data.name !== undefined) {
    if (
      typeof data.name !== "string" ||
      !data.name.trim()
    ) {
      throw new Error("Organization name cannot be empty");
    }

    updates.name = data.name.trim();
  }

  for (const field of REQUIRED_STRING_FIELDS) {
    const value = data[field];

    if (value === undefined) continue;

    if (typeof value !== "string" || !value.trim()) {
      throw new Error(`${field} cannot be empty`);
    }

    updates[field] = value.trim();
  }

  if (data.currency !== undefined) {
    if (typeof data.currency !== "string" || !data.currency.trim()) {
      throw new Error("currency cannot be empty");
    }

    const currency = data.currency.trim().toUpperCase();

    if (!isSupportedCurrency(currency)) {
      throw new Error(
        `currency must be one of: ${SUPPORTED_CURRENCY_CODES.join(", ")}`
      );
    }

    updates.currency = currency;
  }

  for (const field of ["base_currency", "display_currency"] as const) {
    const value = data[field];

    if (value === undefined) continue;

    if (value === null) {
      updates[field] = null;
      continue;
    }

    if (typeof value !== "string" || !value.trim()) {
      throw new Error(`${field} must be a supported currency code or null`);
    }

    const currency = value.trim().toUpperCase();

    if (!isSupportedCurrency(currency)) {
      throw new Error(
        `${field} must be one of: ${SUPPORTED_CURRENCY_CODES.join(", ")}`
      );
    }

    updates[field] = currency;
  }

  if (data.exchange_rate_mode !== undefined) {
    if (
      data.exchange_rate_mode !== "auto" &&
      data.exchange_rate_mode !== "manual"
    ) {
      throw new Error("exchange_rate_mode must be 'auto' or 'manual'");
    }

    updates.exchange_rate_mode = data.exchange_rate_mode;
  }

  for (const field of NULLABLE_STRING_FIELDS) {
    const value = data[field];

    if (value === undefined) continue;

    if (value !== null && typeof value !== "string") {
      throw new Error(`${field} must be a string or null`);
    }

    updates[field] =
      value === null ? null : (value as string).trim() || null;
  }

  if (Object.keys(updates).length === 0) {
    throw new Error("No valid fields provided to update");
  }

  return updates;
}
