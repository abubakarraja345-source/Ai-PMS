import { randomUUID } from "node:crypto";
import { supabase } from "../config/supabase";

const DEFAULT_SIGNED_URL_EXPIRY_SECONDS = 60 * 10;

export interface StorageObjectMetadata {
  size: number;
  mimetype: string | null;
}

/**
 * Thin wrapper around Supabase Storage. All buckets used by this
 * app are private — nothing here ever returns a permanent public
 * URL; display/download access is always a freshly generated,
 * time-limited signed URL.
 */
export class StorageService {
  static async createSignedUploadUrl(bucket: string, path: string) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (error) {
      throw error;
    }

    return data;
  }

  static async createSignedUrl(
    bucket: string,
    path: string,
    expiresIn: number = DEFAULT_SIGNED_URL_EXPIRY_SECONDS
  ): Promise<string> {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error) {
      throw error;
    }

    return data.signedUrl;
  }

  /**
   * Batch variant — used when listing several images/documents at
   * once, so a 20-image gallery costs one Storage call instead of 20.
   */
  static async createSignedUrls(
    bucket: string,
    paths: string[],
    expiresIn: number = DEFAULT_SIGNED_URL_EXPIRY_SECONDS
  ): Promise<Map<string, string | null>> {
    if (paths.length === 0) return new Map();

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrls(paths, expiresIn);

    if (error) {
      throw error;
    }

    const result = new Map<string, string | null>();

    for (const entry of data) {
      result.set(entry.path ?? "", entry.signedUrl ?? null);
    }

    return result;
  }

  /**
   * Confirms an uploaded object actually exists and reports its
   * real server-observed size/type — used to enforce size/type
   * limits AFTER upload, since a presigned upload URL itself
   * cannot enforce them.
   */
  static async getObjectMetadata(
    bucket: string,
    path: string
  ): Promise<StorageObjectMetadata | null> {
    const lastSlash = path.lastIndexOf("/");
    const folder = lastSlash >= 0 ? path.slice(0, lastSlash) : "";
    const fileName = lastSlash >= 0 ? path.slice(lastSlash + 1) : path;

    const { data, error } = await supabase.storage
      .from(bucket)
      .list(folder, { search: fileName });

    if (error) {
      throw error;
    }

    const found = data?.find((entry) => entry.name === fileName);

    if (!found) {
      return null;
    }

    return {
      size: Number(found.metadata?.size ?? 0),
      mimetype: found.metadata?.mimetype ?? null,
    };
  }

  static async deleteObject(bucket: string, path: string): Promise<void> {
    const { error } = await supabase.storage.from(bucket).remove([path]);

    if (error) {
      throw error;
    }
  }

  static async deleteObjects(
    bucket: string,
    paths: string[]
  ): Promise<void> {
    if (paths.length === 0) return;

    const { error } = await supabase.storage.from(bucket).remove(paths);

    if (error) {
      throw error;
    }
  }
}

/**
 * Server-generated storage path — never accepted from a client.
 * Namespacing by organizationId/propertyId keeps one organization
 * from ever reading or overwriting another's files even though
 * every property shares the same bucket.
 */
export function buildStoragePath(
  organizationId: string,
  propertyId: string,
  fileName: string
): string {
  const dotIndex = fileName.lastIndexOf(".");
  const rawExt = dotIndex >= 0 ? fileName.slice(dotIndex) : "";
  const safeExt = rawExt.toLowerCase().replace(/[^a-z0-9.]/g, "");

  return `${organizationId}/${propertyId}/${randomUUID()}${safeExt}`;
}
