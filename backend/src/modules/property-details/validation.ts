export const DOCUMENTS_BUCKET = "documents";

export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const ALLOWED_DOCUMENT_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
] as const;

/* ------------------------------- Amenities ------------------------------ */

export interface CreateAmenityInput {
  name: string;
  category: string | null;
}

export function validateCreateAmenity(input: unknown): CreateAmenityInput {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid request body");
  }

  const data = input as Record<string, unknown>;

  if (typeof data.name !== "string" || !data.name.trim()) {
    throw new Error("Amenity name is required");
  }

  if (
    data.category !== undefined &&
    data.category !== null &&
    typeof data.category !== "string"
  ) {
    throw new Error("Amenity category must be a string or null");
  }

  return {
    name: data.name.trim(),
    category:
      typeof data.category === "string"
        ? data.category.trim() || null
        : null,
  };
}

/* ---------------------------------- Rules -------------------------------- */

export interface CreateRuleInput {
  title: string;
  description: string | null;
}

export function validateCreateRule(input: unknown): CreateRuleInput {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid request body");
  }

  const data = input as Record<string, unknown>;

  if (typeof data.title !== "string" || !data.title.trim()) {
    throw new Error("Rule title is required");
  }

  if (
    data.description !== undefined &&
    data.description !== null &&
    typeof data.description !== "string"
  ) {
    throw new Error("Rule description must be a string or null");
  }

  return {
    title: data.title.trim(),
    description:
      typeof data.description === "string"
        ? data.description.trim() || null
        : null,
  };
}

export interface UpdateRuleInput {
  title?: string;
  description?: string | null;
}

export function validateUpdateRule(input: unknown): UpdateRuleInput {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid request body");
  }

  const data = input as Record<string, unknown>;
  const updates: UpdateRuleInput = {};

  if (data.title !== undefined) {
    if (typeof data.title !== "string" || !data.title.trim()) {
      throw new Error("Rule title cannot be empty");
    }

    updates.title = data.title.trim();
  }

  if (data.description !== undefined) {
    if (data.description !== null && typeof data.description !== "string") {
      throw new Error("Rule description must be a string or null");
    }

    updates.description =
      typeof data.description === "string"
        ? data.description.trim() || null
        : null;
  }

  if (Object.keys(updates).length === 0) {
    throw new Error("No valid fields provided to update");
  }

  return updates;
}

/* -------------------------------- Documents ------------------------------ */

export interface RequestDocumentUploadInput {
  fileName: string;
  contentType: string;
  fileSize: number;
}

export function validateRequestDocumentUpload(
  input: unknown
): RequestDocumentUploadInput {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid request body");
  }

  const data = input as Record<string, unknown>;

  if (typeof data.fileName !== "string" || !data.fileName.trim()) {
    throw new Error("fileName is required");
  }

  const fileName = data.fileName.trim();
  const dotIndex = fileName.lastIndexOf(".");
  const ext = dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : "";

  if (
    !ALLOWED_DOCUMENT_EXTENSIONS.includes(
      ext as (typeof ALLOWED_DOCUMENT_EXTENSIONS)[number]
    )
  ) {
    throw new Error(
      `Documents must be one of: ${ALLOWED_DOCUMENT_EXTENSIONS.join(", ")}`
    );
  }

  if (
    typeof data.contentType !== "string" ||
    !ALLOWED_DOCUMENT_MIME_TYPES.includes(
      data.contentType as (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number]
    )
  ) {
    throw new Error(
      `Document content type must be one of: ${ALLOWED_DOCUMENT_MIME_TYPES.join(", ")}`
    );
  }

  if (
    typeof data.fileSize !== "number" ||
    !Number.isFinite(data.fileSize) ||
    data.fileSize <= 0
  ) {
    throw new Error("fileSize must be a positive number");
  }

  if (data.fileSize > MAX_DOCUMENT_SIZE_BYTES) {
    throw new Error(
      `Documents cannot exceed ${MAX_DOCUMENT_SIZE_BYTES / (1024 * 1024)}MB`
    );
  }

  return {
    fileName,
    contentType: data.contentType,
    fileSize: data.fileSize,
  };
}

export interface ConfirmDocumentUploadInput {
  path: string;
  name: string;
  documentType: string | null;
}

export function validateConfirmDocumentUpload(
  input: unknown
): ConfirmDocumentUploadInput {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid request body");
  }

  const data = input as Record<string, unknown>;

  if (typeof data.path !== "string" || !data.path.trim()) {
    throw new Error("path is required");
  }

  if (typeof data.name !== "string" || !data.name.trim()) {
    throw new Error("Document name is required");
  }

  if (
    data.documentType !== undefined &&
    data.documentType !== null &&
    typeof data.documentType !== "string"
  ) {
    throw new Error("documentType must be a string or null");
  }

  return {
    path: data.path.trim(),
    name: data.name.trim(),
    documentType:
      typeof data.documentType === "string"
        ? data.documentType.trim() || null
        : null,
  };
}
