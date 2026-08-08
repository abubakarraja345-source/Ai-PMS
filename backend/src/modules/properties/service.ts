import {
  CreatePropertyInput,
  validateCreateProperty,
} from "./validation";

import {
  createProperty,
  findPropertiesByOrganization,
  findPropertyById,
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