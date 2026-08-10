import { verifyProperty } from "../reservations/service";
import { StorageService, buildStoragePath } from "../../services/storage.service";

import {
  createAmenityRow,
  createDocumentRow,
  createRuleRow,
  deleteAmenityRow,
  deleteDocumentRow,
  deleteRuleRow,
  findAmenitiesByProperty,
  findDocumentById,
  findDocumentsByProperty,
  findRuleById,
  findRulesByProperty,
  updateRuleRow,
} from "./repository";

import { Amenity, AmenityRow, PropertyDocument, DocumentRow, Rule, RuleRow } from "./types";

import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  ConfirmDocumentUploadInput,
  DOCUMENTS_BUCKET,
  MAX_DOCUMENT_SIZE_BYTES,
  RequestDocumentUploadInput,
  UpdateRuleInput,
} from "./validation";

async function assertPropertyInOrganization(
  organizationId: string,
  propertyId: string
): Promise<void> {
  const exists = await verifyProperty(organizationId, propertyId);

  if (!exists) {
    throw new Error("Property not found in your organization");
  }
}

/* ------------------------------- Amenities ------------------------------ */

function toClientAmenity(row: AmenityRow): Amenity {
  return {
    id: row.id,
    name: row.amenity_name,
    category: row.amenity_category,
    createdAt: row.created_at,
  };
}

export async function listAmenities(
  organizationId: string,
  propertyId: string
): Promise<Amenity[]> {
  await assertPropertyInOrganization(organizationId, propertyId);

  const rows = await findAmenitiesByProperty(propertyId);

  return rows.map(toClientAmenity);
}

export async function addAmenity(
  organizationId: string,
  propertyId: string,
  name: string,
  category: string | null
): Promise<Amenity> {
  await assertPropertyInOrganization(organizationId, propertyId);

  const row = await createAmenityRow(propertyId, name, category);

  return toClientAmenity(row);
}

export async function removeAmenity(
  organizationId: string,
  propertyId: string,
  amenityId: string
): Promise<boolean> {
  await assertPropertyInOrganization(organizationId, propertyId);

  return deleteAmenityRow(propertyId, amenityId);
}

/* ---------------------------------- Rules -------------------------------- */

function toClientRule(row: RuleRow): Rule {
  return {
    id: row.id,
    title: row.rule_title,
    description: row.rule_description,
    createdAt: row.created_at,
  };
}

export async function listRules(
  organizationId: string,
  propertyId: string
): Promise<Rule[]> {
  await assertPropertyInOrganization(organizationId, propertyId);

  const rows = await findRulesByProperty(propertyId);

  return rows.map(toClientRule);
}

export async function addRule(
  organizationId: string,
  propertyId: string,
  title: string,
  description: string | null
): Promise<Rule> {
  await assertPropertyInOrganization(organizationId, propertyId);

  const row = await createRuleRow(propertyId, title, description);

  return toClientRule(row);
}

export async function editRule(
  organizationId: string,
  propertyId: string,
  ruleId: string,
  updates: UpdateRuleInput
): Promise<Rule | null> {
  await assertPropertyInOrganization(organizationId, propertyId);

  const existing = await findRuleById(propertyId, ruleId);

  if (!existing) {
    return null;
  }

  const dbUpdates: Record<string, unknown> = {};

  if (updates.title !== undefined) dbUpdates.rule_title = updates.title;
  if (updates.description !== undefined)
    dbUpdates.rule_description = updates.description;

  const updated = await updateRuleRow(propertyId, ruleId, dbUpdates);

  return updated ? toClientRule(updated) : null;
}

export async function removeRule(
  organizationId: string,
  propertyId: string,
  ruleId: string
): Promise<boolean> {
  await assertPropertyInOrganization(organizationId, propertyId);

  return deleteRuleRow(propertyId, ruleId);
}

/* -------------------------------- Documents ------------------------------ */

async function toClientDocument(row: DocumentRow): Promise<PropertyDocument> {
  const signedUrl = await StorageService.createSignedUrl(
    DOCUMENTS_BUCKET,
    row.document_url
  ).catch(() => null);

  return {
    id: row.id,
    name: row.document_name,
    documentType: row.document_type,
    signedUrl,
    createdAt: row.created_at,
  };
}

export async function listDocuments(
  organizationId: string,
  propertyId: string
): Promise<PropertyDocument[]> {
  await assertPropertyInOrganization(organizationId, propertyId);

  const rows = await findDocumentsByProperty(propertyId);

  return Promise.all(rows.map(toClientDocument));
}

export async function requestDocumentUpload(
  organizationId: string,
  propertyId: string,
  input: RequestDocumentUploadInput
) {
  await assertPropertyInOrganization(organizationId, propertyId);

  const path = buildStoragePath(organizationId, propertyId, input.fileName);
  const { signedUrl, token } = await StorageService.createSignedUploadUrl(
    DOCUMENTS_BUCKET,
    path
  );

  return { bucket: DOCUMENTS_BUCKET, path, signedUrl, token };
}

export async function confirmDocumentUpload(
  organizationId: string,
  propertyId: string,
  uploadedBy: string,
  input: ConfirmDocumentUploadInput
): Promise<PropertyDocument> {
  await assertPropertyInOrganization(organizationId, propertyId);

  const expectedPrefix = `${organizationId}/${propertyId}/`;

  if (!input.path.startsWith(expectedPrefix)) {
    throw new Error("Invalid upload path");
  }

  const metadata = await StorageService.getObjectMetadata(
    DOCUMENTS_BUCKET,
    input.path
  );

  if (!metadata) {
    throw new Error("Uploaded file was not found in storage");
  }

  if (metadata.size > MAX_DOCUMENT_SIZE_BYTES) {
    await StorageService.deleteObject(DOCUMENTS_BUCKET, input.path).catch(
      () => undefined
    );

    throw new Error(
      `Documents cannot exceed ${MAX_DOCUMENT_SIZE_BYTES / (1024 * 1024)}MB`
    );
  }

  if (
    !metadata.mimetype ||
    !ALLOWED_DOCUMENT_MIME_TYPES.includes(
      metadata.mimetype as (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number]
    )
  ) {
    await StorageService.deleteObject(DOCUMENTS_BUCKET, input.path).catch(
      () => undefined
    );

    throw new Error("Unsupported document type");
  }

  const row = await createDocumentRow(propertyId, uploadedBy, {
    path: input.path,
    name: input.name,
    documentType: input.documentType,
  });

  return toClientDocument(row);
}

export async function removeDocument(
  organizationId: string,
  propertyId: string,
  documentId: string
): Promise<boolean> {
  await assertPropertyInOrganization(organizationId, propertyId);

  const existing = await findDocumentById(propertyId, documentId);

  if (!existing) {
    return false;
  }

  const deleted = await deleteDocumentRow(propertyId, documentId);

  if (!deleted) {
    return false;
  }

  await StorageService.deleteObject(
    DOCUMENTS_BUCKET,
    existing.document_url
  ).catch((error) => {
    console.error("Failed to delete document storage object:", error);
  });

  return true;
}
