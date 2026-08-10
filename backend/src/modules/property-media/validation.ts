export const IMAGES_BUCKET = "property-images";

export const MAX_IMAGES_PER_PROPERTY = 20;
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

export const ALLOWED_IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
] as const;

export interface RequestImageUploadInput {
  fileName: string;
  contentType: string;
  fileSize: number;
}

export function validateRequestImageUpload(
  input: unknown
): RequestImageUploadInput {
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
    !ALLOWED_IMAGE_EXTENSIONS.includes(
      ext as (typeof ALLOWED_IMAGE_EXTENSIONS)[number]
    )
  ) {
    throw new Error(
      `Images must be one of: ${ALLOWED_IMAGE_EXTENSIONS.join(", ")}`
    );
  }

  if (
    typeof data.contentType !== "string" ||
    !ALLOWED_IMAGE_MIME_TYPES.includes(
      data.contentType as (typeof ALLOWED_IMAGE_MIME_TYPES)[number]
    )
  ) {
    throw new Error(
      `Image content type must be one of: ${ALLOWED_IMAGE_MIME_TYPES.join(", ")}`
    );
  }

  if (
    typeof data.fileSize !== "number" ||
    !Number.isFinite(data.fileSize) ||
    data.fileSize <= 0
  ) {
    throw new Error("fileSize must be a positive number");
  }

  if (data.fileSize > MAX_IMAGE_SIZE_BYTES) {
    throw new Error(
      `Images cannot exceed ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)}MB`
    );
  }

  return {
    fileName,
    contentType: data.contentType,
    fileSize: data.fileSize,
  };
}

export interface ConfirmImageUploadInput {
  path: string;
  altText: string | null;
}

export function validateConfirmImageUpload(
  input: unknown
): ConfirmImageUploadInput {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid request body");
  }

  const data = input as Record<string, unknown>;

  if (typeof data.path !== "string" || !data.path.trim()) {
    throw new Error("path is required");
  }

  if (
    data.altText !== undefined &&
    data.altText !== null &&
    typeof data.altText !== "string"
  ) {
    throw new Error("altText must be a string or null");
  }

  return {
    path: data.path.trim(),
    altText:
      typeof data.altText === "string"
        ? data.altText.trim() || null
        : null,
  };
}

export interface UpdateImageInput {
  altText?: string | null;
  isCover?: boolean;
}

export function validateUpdateImage(input: unknown): UpdateImageInput {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid request body");
  }

  const data = input as Record<string, unknown>;
  const updates: UpdateImageInput = {};

  if (data.altText !== undefined) {
    if (data.altText !== null && typeof data.altText !== "string") {
      throw new Error("altText must be a string or null");
    }

    updates.altText =
      typeof data.altText === "string"
        ? data.altText.trim() || null
        : null;
  }

  if (data.isCover !== undefined) {
    if (typeof data.isCover !== "boolean") {
      throw new Error("isCover must be a boolean");
    }

    if (data.isCover !== true) {
      throw new Error(
        "isCover can only be set to true — remove the current cover by setting a different image as cover instead"
      );
    }

    updates.isCover = true;
  }

  if (Object.keys(updates).length === 0) {
    throw new Error("No valid fields provided to update");
  }

  return updates;
}

export function validateReorderImages(input: unknown): string[] {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid request body");
  }

  const data = input as Record<string, unknown>;

  if (!Array.isArray(data.order) || data.order.length === 0) {
    throw new Error("order must be a non-empty array of image IDs");
  }

  if (!data.order.every((id) => typeof id === "string" && id.trim())) {
    throw new Error("order must contain only image ID strings");
  }

  return data.order as string[];
}
