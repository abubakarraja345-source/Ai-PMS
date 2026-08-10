import { verifyProperty } from "../reservations/service";
import { StorageService, buildStoragePath } from "../../services/storage.service";

import {
  clearCoverForProperty,
  countImagesByProperty,
  createImageRow,
  deleteImageRow,
  findImageById,
  findImagesByProperty,
  updateDisplayOrders,
  updateImageRow,
} from "./repository";

import { PropertyImage, PropertyImageRow } from "./types";

import {
  ALLOWED_IMAGE_MIME_TYPES,
  ConfirmImageUploadInput,
  IMAGES_BUCKET,
  MAX_IMAGES_PER_PROPERTY,
  MAX_IMAGE_SIZE_BYTES,
  RequestImageUploadInput,
  UpdateImageInput,
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

async function toClientImage(
  row: PropertyImageRow,
  signedUrl: string | null
): Promise<PropertyImage> {
  return {
    id: row.id,
    altText: row.alt_text,
    displayOrder: row.display_order,
    isCover: row.is_cover,
    signedUrl,
    createdAt: row.created_at,
  };
}

export async function listPropertyImages(
  organizationId: string,
  propertyId: string
): Promise<PropertyImage[]> {
  await assertPropertyInOrganization(organizationId, propertyId);

  const rows = await findImagesByProperty(propertyId);

  const signedUrls = await StorageService.createSignedUrls(
    IMAGES_BUCKET,
    rows.map((row) => row.image_url)
  );

  return Promise.all(
    rows.map((row) =>
      toClientImage(row, signedUrls.get(row.image_url) ?? null)
    )
  );
}

/**
 * Step 1 of upload: validate the declared file, verify ownership
 * and the 20-image cap, generate a server-side path (never
 * client-supplied), and hand back a short-lived signed upload URL.
 * No database row exists yet — that only happens once the upload
 * is confirmed.
 */
export async function requestImageUpload(
  organizationId: string,
  propertyId: string,
  input: RequestImageUploadInput
) {
  await assertPropertyInOrganization(organizationId, propertyId);

  const existingCount = await countImagesByProperty(propertyId);

  if (existingCount >= MAX_IMAGES_PER_PROPERTY) {
    throw new Error(
      `A property can have at most ${MAX_IMAGES_PER_PROPERTY} images`
    );
  }

  const path = buildStoragePath(organizationId, propertyId, input.fileName);
  const { signedUrl, token } = await StorageService.createSignedUploadUrl(
    IMAGES_BUCKET,
    path
  );

  return { bucket: IMAGES_BUCKET, path, signedUrl, token };
}

/**
 * Step 2 of upload: the client has already PUT the file directly
 * to Storage using the signed URL from step 1. This confirms the
 * object really exists, re-checks its real size/type server-side
 * (a signed upload URL cannot enforce those on its own), and only
 * then creates the database row.
 */
export async function confirmImageUpload(
  organizationId: string,
  propertyId: string,
  input: ConfirmImageUploadInput
): Promise<PropertyImage> {
  await assertPropertyInOrganization(organizationId, propertyId);

  const expectedPrefix = `${organizationId}/${propertyId}/`;

  if (!input.path.startsWith(expectedPrefix)) {
    throw new Error("Invalid upload path");
  }

  const existingCount = await countImagesByProperty(propertyId);

  if (existingCount >= MAX_IMAGES_PER_PROPERTY) {
    await StorageService.deleteObject(IMAGES_BUCKET, input.path).catch(
      () => undefined
    );

    throw new Error(
      `A property can have at most ${MAX_IMAGES_PER_PROPERTY} images`
    );
  }

  const metadata = await StorageService.getObjectMetadata(
    IMAGES_BUCKET,
    input.path
  );

  if (!metadata) {
    throw new Error("Uploaded file was not found in storage");
  }

  if (metadata.size > MAX_IMAGE_SIZE_BYTES) {
    await StorageService.deleteObject(IMAGES_BUCKET, input.path).catch(
      () => undefined
    );

    throw new Error(
      `Images cannot exceed ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)}MB`
    );
  }

  if (
    !metadata.mimetype ||
    !ALLOWED_IMAGE_MIME_TYPES.includes(
      metadata.mimetype as (typeof ALLOWED_IMAGE_MIME_TYPES)[number]
    )
  ) {
    await StorageService.deleteObject(IMAGES_BUCKET, input.path).catch(
      () => undefined
    );

    throw new Error("Unsupported image type");
  }

  const isCover = existingCount === 0;

  const row = await createImageRow(propertyId, {
    imagePath: input.path,
    altText: input.altText,
    displayOrder: existingCount,
    isCover,
  });

  const signedUrl = await StorageService.createSignedUrl(
    IMAGES_BUCKET,
    row.image_url
  );

  return toClientImage(row, signedUrl);
}

export async function updatePropertyImage(
  organizationId: string,
  propertyId: string,
  imageId: string,
  updates: UpdateImageInput
): Promise<PropertyImage | null> {
  await assertPropertyInOrganization(organizationId, propertyId);

  const existing = await findImageById(propertyId, imageId);

  if (!existing) {
    return null;
  }

  if (updates.isCover) {
    await clearCoverForProperty(propertyId);
  }

  const dbUpdates: Record<string, unknown> = {};

  if (updates.altText !== undefined) {
    dbUpdates.alt_text = updates.altText;
  }

  if (updates.isCover !== undefined) {
    dbUpdates.is_cover = updates.isCover;
  }

  const updated = await updateImageRow(propertyId, imageId, dbUpdates);

  if (!updated) {
    return null;
  }

  const signedUrl = await StorageService.createSignedUrl(
    IMAGES_BUCKET,
    updated.image_url
  );

  return toClientImage(updated, signedUrl);
}

export async function reorderPropertyImages(
  organizationId: string,
  propertyId: string,
  orderedImageIds: string[]
): Promise<PropertyImage[]> {
  await assertPropertyInOrganization(organizationId, propertyId);

  const existing = await findImagesByProperty(propertyId);
  const existingIds = new Set(existing.map((row) => row.id));

  const sameSet =
    orderedImageIds.length === existing.length &&
    orderedImageIds.every((id) => existingIds.has(id));

  if (!sameSet) {
    throw new Error(
      "order must include exactly the property's current images"
    );
  }

  await updateDisplayOrders(propertyId, orderedImageIds);

  return listPropertyImages(organizationId, propertyId);
}

export async function removePropertyImage(
  organizationId: string,
  propertyId: string,
  imageId: string
): Promise<boolean> {
  await assertPropertyInOrganization(organizationId, propertyId);

  const existing = await findImageById(propertyId, imageId);

  if (!existing) {
    return false;
  }

  const deleted = await deleteImageRow(propertyId, imageId);

  if (!deleted) {
    return false;
  }

  await StorageService.deleteObject(IMAGES_BUCKET, existing.image_url).catch(
    (error) => {
      console.error("Failed to delete image storage object:", error);
    }
  );

  if (existing.is_cover) {
    const remaining = await findImagesByProperty(propertyId);
    const next = remaining[0];

    if (next) {
      await updateImageRow(propertyId, next.id, { is_cover: true });
    }
  }

  return true;
}
