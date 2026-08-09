export interface CreateGuestInput {
  first_name: string;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  country?: string | null;
  language?: string | null;
  passport_number?: string | null;
  notes?: string | null;
  vip?: boolean;
}

export function validateCreateGuest(
  input: unknown
): CreateGuestInput {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid request body");
  }

  const data = input as Record<string, unknown>;

  if (
    typeof data.first_name !== "string" ||
    !data.first_name.trim()
  ) {
    throw new Error("First name is required");
  }

  return {
    first_name: data.first_name.trim(),

    last_name:
      typeof data.last_name === "string"
        ? data.last_name.trim()
        : null,

    email:
      typeof data.email === "string"
        ? data.email.trim()
        : null,

    phone:
      typeof data.phone === "string"
        ? data.phone.trim()
        : null,

    country:
      typeof data.country === "string"
        ? data.country.trim()
        : null,

    language:
      typeof data.language === "string"
        ? data.language.trim()
        : null,

    passport_number:
      typeof data.passport_number === "string"
        ? data.passport_number.trim()
        : null,

    notes:
      typeof data.notes === "string"
        ? data.notes.trim()
        : null,

    vip:
      typeof data.vip === "boolean"
        ? data.vip
        : false,
  };
}