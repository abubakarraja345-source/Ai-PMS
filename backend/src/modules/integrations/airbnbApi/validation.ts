export interface CallbackInput {
  state: string;
  code: string;
}

export function validateCallback(input: unknown): CallbackInput {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid request body");
  }

  const data = input as Record<string, unknown>;

  if (typeof data.state !== "string" || !data.state.trim()) {
    throw new Error("state is required");
  }

  if (typeof data.code !== "string" || !data.code.trim()) {
    throw new Error("code is required");
  }

  return { state: data.state.trim(), code: data.code.trim() };
}

export interface NewPropertyFromListingInput {
  title: string;
  propertyType: string;
}

/**
 * The "Create New Property" branch of the listing mapping screen
 * (Phase 6B). Deliberately tiny: property_type has no reliable source
 * from a listing payload (AirbnbListing.propertyType, when present, is
 * free-form provider text, not this app's own property_type taxonomy)
 * so the user picks it explicitly rather than the API guessing/
 * fabricating a value. title defaults to the listing's own name
 * client-side but can be edited before submit.
 */
function validateNewPropertyFromListing(
  value: unknown
): NewPropertyFromListingInput {
  if (!value || typeof value !== "object") {
    throw new Error("newProperty must be an object");
  }

  const data = value as Record<string, unknown>;

  if (typeof data.title !== "string" || !data.title.trim()) {
    throw new Error("newProperty.title is required");
  }

  if (typeof data.propertyType !== "string" || !data.propertyType.trim()) {
    throw new Error("newProperty.propertyType is required");
  }

  return {
    title: data.title.trim(),
    propertyType: data.propertyType.trim(),
  };
}

export interface ImportListingInput {
  externalListingId: string;
  externalListingName: string | null;
  propertyId: string | null;
  newProperty: NewPropertyFromListingInput | null;
}

export function validateImportListing(input: unknown): ImportListingInput {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid request body");
  }

  const data = input as Record<string, unknown>;

  if (
    typeof data.externalListingId !== "string" ||
    !data.externalListingId.trim()
  ) {
    throw new Error("externalListingId is required");
  }

  const hasPropertyId =
    typeof data.propertyId === "string" && data.propertyId.trim();
  const hasNewProperty = data.newProperty !== undefined && data.newProperty !== null;

  if (!hasPropertyId && !hasNewProperty) {
    throw new Error(
      "Provide either propertyId (map to an existing property) or newProperty (create a new one)"
    );
  }

  if (hasPropertyId && hasNewProperty) {
    throw new Error("Provide only one of propertyId or newProperty, not both");
  }

  if (
    data.externalListingName !== undefined &&
    data.externalListingName !== null &&
    typeof data.externalListingName !== "string"
  ) {
    throw new Error("externalListingName must be a string or null");
  }

  return {
    externalListingId: data.externalListingId.trim(),
    externalListingName:
      typeof data.externalListingName === "string"
        ? data.externalListingName.trim() || null
        : null,
    propertyId: hasPropertyId ? (data.propertyId as string).trim() : null,
    newProperty: hasNewProperty
      ? validateNewPropertyFromListing(data.newProperty)
      : null,
  };
}
