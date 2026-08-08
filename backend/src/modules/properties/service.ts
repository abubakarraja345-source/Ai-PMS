import {
  CreatePropertyInput,
  validateCreateProperty,
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
  updates: Record<string, unknown>
) {
  if (!organizationId) {
    throw new Error("Organization ID is required");
  }

  if (!propertyId) {
    throw new Error("Property ID is required");
  }

  if (!updates || Object.keys(updates).length === 0) {
    throw new Error("No updates provided");
  }

  // Prevent clients from changing ownership/security fields
  delete updates.id;
  delete updates.organization_id;
  delete updates.created_by;
  delete updates.created_at;

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