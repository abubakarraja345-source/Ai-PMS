"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

interface PropertyDocument {
  id: string;
  name: string;
  documentType: string | null;
  signedUrl: string | null;
  createdAt: string;
}

const MAX_DOCUMENT_SIZE_MB = 10;
const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

export default function PropertyDocumentsSection({
  propertyId,
  canManage,
}: {
  propertyId: string;
  canManage: boolean;
}) {
  const [documents, setDocuments] = useState<PropertyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await apiFetch(
        `/api/properties/${propertyId}/documents`
      );

      setDocuments(response.data ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load documents."
      );
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  async function handleFileSelected(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Only PDF, DOC, and DOCX documents are allowed.");
      return;
    }

    if (file.size > MAX_DOCUMENT_SIZE_MB * 1024 * 1024) {
      setError(`Documents cannot exceed ${MAX_DOCUMENT_SIZE_MB}MB.`);
      return;
    }

    try {
      setUploading(true);
      setError("");

      const uploadRequest = await apiFetch(
        `/api/properties/${propertyId}/documents/upload-url`,
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

      await apiFetch(`/api/properties/${propertyId}/documents`, {
        method: "POST",
        body: JSON.stringify({ path, name: file.name }),
      });

      await loadDocuments();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to upload document."
      );
    } finally {
      setUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleDelete(documentId: string) {
    const confirmed = window.confirm(
      "Delete this document?\n\nThis action cannot be undone."
    );

    if (!confirmed) return;

    try {
      setDeletingId(documentId);
      setError("");

      await apiFetch(
        `/api/properties/${propertyId}/documents/${documentId}`,
        { method: "DELETE" }
      );

      setDocuments((current) =>
        current.filter((document) => document.id !== documentId)
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete document."
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Documents
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Contracts, permits, and other property files.
          </p>
        </div>

        {canManage && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              className="hidden"
              onChange={(event) =>
                handleFileSelected(event.target.files)
              }
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="rounded-xl bg-gradient-to-r from-primary to-accent px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "+ Add Document"}
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
        <div className="mt-5 text-sm text-muted-foreground">
          Loading documents...
        </div>
      ) : documents.length === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground/80">
          No documents uploaded yet.
        </p>
      ) : (
        <ul className="mt-5 space-y-2">
          {documents.map((document) => (
            <li
              key={document.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-muted p-4"
            >
              <div className="min-w-0">
                {document.signedUrl ? (
                  <a
                    href={document.signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-sm font-medium text-foreground underline"
                  >
                    {document.name}
                  </a>
                ) : (
                  <p className="truncate text-sm font-medium text-foreground">
                    {document.name}
                  </p>
                )}

                <p className="mt-1 text-xs text-muted-foreground/80">
                  Uploaded {formatDate(document.createdAt)}
                </p>
              </div>

              {canManage && (
                <button
                  onClick={() => handleDelete(document.id)}
                  disabled={deletingId === document.id}
                  className="flex-shrink-0 text-xs text-muted-foreground/80 hover:text-red-600 disabled:opacity-50"
                >
                  {deletingId === document.id ? "..." : "Delete"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
