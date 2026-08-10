import {
  CreatePropertyInput,
  validateCreateProperty,
  validateUpdateProperty,
} from "./validation";

import {
  createProperty,
  findPropertiesByOrganization,
  findPropertyById,
  updateProperty,
  deleteProperty,
} from "./repository";

export async function getProperties(
  organizationId: string
) {
  if (!organizationId) {
    throw new Error("Organization ID is required");
  }

  return findPropertiesByOrganization(organizationId);
}

export async function addProperty(
  organizationId: string,
  userId: string,
  input: unknown
) {
  if (!organizationId) {
    throw new Error("Organization ID is required");
  }

  if (!userId) {
    throw new Error("User ID is required");
  }

  const validatedInput: CreatePropertyInput =
    validateCreateProperty(input);

  return createProperty(
    organizationId,
    userId,
    validatedInput
  );
}
export async function getProperty(
  organizationId: string,
  propertyId: string
) {
  if (!organizationId) {
    throw new Error("Organization ID is required");
  }

  if (!propertyId) {
    throw new Error("Property ID is required");
  }

  return findPropertyById(
    organizationId,
    propertyId
  );
}

export async function editProperty(
  organizationId: string,
  propertyId: string,
  rawUpdates: unknown
) {
  if (!organizationId) {
    throw new Error("Organization ID is required");
  }

  if (!propertyId) {
    throw new Error("Property ID is required");
  }

  // Validates types and allowlists fields — protected
  // columns (id, organization_id, created_by, created_at)
  // are never part of the allowlist, so they can't be
  // written through this path.
  const updates = validateUpdateProperty(rawUpdates);

  return updateProperty(
    organizationId,
    propertyId,
    updates
  );
}
export async function removeProperty(
  organizationId: string,
  propertyId: string
) {
  if (!organizationId) {
    throw new Error("Organization ID is required");
  }

  if (!propertyId) {
    throw new Error("Property ID is required");
  }

  return deleteProperty(
    organizationId,
    propertyId
  );
}