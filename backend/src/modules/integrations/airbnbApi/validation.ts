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

export interface ImportListingInput {
  externalListingId: string;
  externalListingName: string | null;
  propertyId: string;
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

  if (typeof data.propertyId !== "string" || !data.propertyId.trim()) {
    throw new Error("propertyId is required");
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
    propertyId: data.propertyId.trim(),
  };
}
