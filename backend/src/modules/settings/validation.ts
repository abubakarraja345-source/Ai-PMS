export interface UpdateSettingsInput {
  name?: string;
  timezone?: string;
  currency?: string;
  language?: string;
  check_in_time?: string | null;
  check_out_time?: string | null;
  guest_message_template?: string | null;
}

/**
 * Fields that must be a non-empty string when supplied. No
 * enum/format is enforced for timezone or currency — the rest
 * of the codebase (reservations.currency, properties.check_in_time)
 * never establishes an allowed-values list for these kinds of
 * fields either, so inventing one here would be a new, unproven
 * business rule.
 */
const REQUIRED_STRING_FIELDS = [
  "timezone",
  "currency",
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
