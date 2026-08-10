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

import { StorageService } from "../../services/storage.service";
import { findImagePathsByProperty } from "../property-media/repository";
import { IMAGES_BUCKET } from "../property-media/validation";
import { findDocumentPathsByProperty } from "../property-details/repository";
import { DOCUMENTS_BUCKET } from "../property-details/validation";

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

  // Storage objects are not covered by the database's ON DELETE
  // CASCADE on property_images/property_documents (confirmed via
  // a live test) — collect their paths before the property (and
  // its cascaded child rows) are gone, so they can still be
  // purged from Storage afterward.
  const [imagePaths, documentPaths] = await Promise.all([
    findImagePathsByProperty(propertyId),
    findDocumentPathsByProperty(propertyId),
  ]);

  const deleted = await deleteProperty(
    organizationId,
    propertyId
  );

  if (deleted) {
    await Promise.all([
      StorageService.deleteObjects(IMAGES_BUCKET, imagePaths).catch(
        (error) => {
          console.error(
            "Failed to delete property image storage objects:",
            error
          );
        }
      ),
      StorageService.deleteObjects(DOCUMENTS_BUCKET, documentPaths).catch(
        (error) => {
          console.error(
            "Failed to delete property document storage objects:",
            error
          );
        }
      ),
    ]);
  }

  return deleted;
}