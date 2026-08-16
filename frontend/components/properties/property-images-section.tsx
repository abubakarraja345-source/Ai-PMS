"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

interface PropertyImage {
  id: string;
  altText: string | null;
  displayOrder: number;
  isCover: boolean;
  signedUrl: string | null;
  createdAt: string;
}

const MAX_IMAGES = 20;
const MAX_IMAGE_SIZE_MB = 5;
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export default function PropertyImagesSection({
  propertyId,
  canManage,
}: {
  propertyId: string;
  canManage: boolean;
}) {
  const [images, setImages] = useState<PropertyImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadImages = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await apiFetch(
        `/api/properties/${propertyId}/images`
      );

      setImages(response.data ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load images."
      );
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  async function uploadFile(file: File) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error("Only JPG, PNG, and WebP images are allowed.");
    }

    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      throw new Error(`Images cannot exceed ${MAX_IMAGE_SIZE_MB}MB.`);
    }

    const uploadRequest = await apiFetch(
      `/api/properties/${propertyId}/images/upload-url`,
      {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size,
        }),
      }
    );

    const { bucket, path, token } = uploadRequest.data;

    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .uploadToSignedUrl(path, token, file);

    if (uploadError) {
      throw new Error(uploadError.message || "Upload failed.");
    }

    await apiFetch(`/api/properties/${propertyId}/images`, {
      method: "POST",
      body: JSON.stringify({ path }),
    });
  }

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);

    if (images.length + files.length > MAX_IMAGES) {
      setError(
        `A property can have at most ${MAX_IMAGES} images (currently ${images.length}).`
      );
      return;
    }

    try {
      setUploading(true);
      setError("");

      for (const file of files) {
        await uploadFile(file);
      }

      await loadImages();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to upload image(s)."
      );
    } finally {
      setUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleSetCover(imageId: string) {
    try {
      setBusyId(imageId);
      setError("");

      await apiFetch(`/api/properties/${propertyId}/images/${imageId}`, {
        method: "PATCH",
        body: JSON.stringify({ isCover: true }),
      });

      await loadImages();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to set cover image."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(imageId: string) {
    const confirmed = window.confirm(
      "Delete this image?\n\nThis action cannot be undone."
    );

    if (!confirmed) return;

    try {
      setBusyId(imageId);
      setError("");

      await apiFetch(`/api/properties/${propertyId}/images/${imageId}`, {
        method: "DELETE",
      });

      setImages((current) => current.filter((img) => img.id !== imageId));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete image."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function persistOrder(nextImages: PropertyImage[]) {
    try {
      setError("");

      await apiFetch(`/api/properties/${propertyId}/images/reorder`, {
        method: "PATCH",
        body: JSON.stringify({ order: nextImages.map((img) => img.id) }),
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save new order."
      );
      await loadImages();
    }
  }

  function handleDragStart(imageId: string) {
    setDragId(imageId);
  }

  function handleDropOn(targetId: string) {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      return;
    }

    const current = [...images];
    const fromIndex = current.findIndex((img) => img.id === dragId);
    const toIndex = current.findIndex((img) => img.id === targetId);

    if (fromIndex === -1 || toIndex === -1) {
      setDragId(null);
      return;
    }

    const [moved] = current.splice(fromIndex, 1);
    current.splice(toIndex, 0, moved);

    setImages(current);
    setDragId(null);
    persistOrder(current);
  }

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Photos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {images.length} / {MAX_IMAGES} images
            {canManage ? " · drag to reorder" : ""}
          </p>
        </div>

        {canManage && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(event) =>
                handleFilesSelected(event.target.files)
              }
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || images.length >= MAX_IMAGES}
              className="rounded-xl bg-gradient-to-r from-primary to-accent px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "+ Add Photos"}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-6 text-sm text-muted-foreground">Loading photos...</div>
      ) : images.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground/80">
          No photos yet.
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((image) => (
            <div
              key={image.id}
              draggable={canManage}
              onDragStart={() => handleDragStart(image.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => handleDropOn(image.id)}
              className={`group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted ${
                canManage ? "cursor-move" : ""
              }`}
            >
              {image.signedUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={image.signedUrl}
                  alt={image.altText ?? "Property photo"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground/80">
                  Unavailable
                </div>
              )}

              {image.isCover && (
                <span className="absolute left-2 top-2 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-medium text-white shadow">
                  Cover
                </span>
              )}

              {canManage && (
                <div className="absolute inset-x-0 bottom-0 flex justify-center gap-2 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
                  {!image.isCover && (
                    <button
                      onClick={() => handleSetCover(image.id)}
                      disabled={busyId === image.id}
                      className="rounded-lg bg-white/90 px-2 py-1 text-xs font-medium text-foreground/90 hover:bg-card disabled:opacity-50"
                    >
                      Set cover
                    </button>
                  )}

                  <button
                    onClick={() => handleDelete(image.id)}
                    disabled={busyId === image.id}
                    className="rounded-lg bg-white/90 px-2 py-1 text-xs font-medium text-red-600 hover:bg-card disabled:opacity-50"
                  >
                    {busyId === image.id ? "..." : "Delete"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
