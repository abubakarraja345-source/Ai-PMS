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
import { logAudit } from "../auditLog/service";
import { OrganizationRole } from "../permissions/roles";
import { resolvePropertyScope } from "../permissions/propertyScope";

export interface CallerScopeContext {
  role: OrganizationRole;
  userId: string;
}

export async function getProperties(
  organizationId: string,
  range: { from: number; to: number },
  caller?: CallerScopeContext
) {
  if (!organizationId) {
    throw new Error("Organization ID is required");
  }

  if (!caller) {
    return findPropertiesByOrganization(organizationId, range);
  }

  const scope = await resolvePropertyScope(organizationId, caller.role, caller.userId);

  if (scope.restricted && scope.propertyIds.length === 0) {
    return { data: [], total: 0 };
  }

  return findPropertiesByOrganization(
    organizationId,
    range,
    scope.restricted ? scope.propertyIds : undefined
  );
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
  propertyId: string,
  caller?: CallerScopeContext
) {
  if (!organizationId) {
    throw new Error("Organization ID is required");
  }

  if (!propertyId) {
    throw new Error("Property ID is required");
  }

  const property = await findPropertyById(
    organizationId,
    propertyId
  );

  if (!property || !caller) {
    return property;
  }

  // Service-layer check for "is this SPECIFIC record in my assigned
  // set" — same layer changeMemberRole's self-change rule already
  // lives in (organization/service.ts). A restricted caller fetching
  // a property outside their scope gets the same null-as-not-found
  // result an org-mismatch already produces, never a distinct
  // "forbidden" signal.
  const scope = await resolvePropertyScope(organizationId, caller.role, caller.userId);

  if (scope.restricted && !scope.propertyIds.includes(propertyId)) {
    return null;
  }

  return property;
}

export async function editProperty(
  organizationId: string,
  propertyId: string,
  rawUpdates: unknown,
  actor?: { id: string; email?: string },
  callerRole?: OrganizationRole
) {
  if (!organizationId) {
    throw new Error("Organization ID is required");
  }

  if (!propertyId) {
    throw new Error("Property ID is required");
  }

  // Property-level access (Phase 7.4) — a scope-restricted Manager
  // can only edit properties actually assigned to them, even though
  // the coarse route gate (properties.update) allows the role to
  // attempt the endpoint at all.
  if (actor && callerRole) {
    const scope = await resolvePropertyScope(organizationId, callerRole, actor.id);

    if (scope.restricted && !scope.propertyIds.includes(propertyId)) {
      return null;
    }
  }

  // Validates types and allowlists fields — protected
  // columns (id, organization_id, created_by, created_at)
  // are never part of the allowlist, so they can't be
  // written through this path.
  const updates = validateUpdateProperty(rawUpdates);

  const previous =
    updates.currency !== undefined
      ? await findPropertyById(organizationId, propertyId)
      : null;

  const updated = await updateProperty(
    organizationId,
    propertyId,
    updates
  );

  if (
    updated &&
    updates.currency !== undefined &&
    updates.currency !== previous?.currency
  ) {
    void logAudit({
      organizationId,
      actorUserId: actor?.id ?? null,
      actorLabel: actor?.email ?? actor?.id ?? null,
      action: "currency.property_changed",
      entityType: "property",
      entityId: propertyId,
      metadata: {
        previousCurrency: previous?.currency ?? null,
        newCurrency: updates.currency,
      },
    });
  }

  return updated;
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