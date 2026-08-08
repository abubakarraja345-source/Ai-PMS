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
  };
}