"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface Amenity {
  id: string;
  name: string;
  category: string | null;
  createdAt: string;
}

export default function PropertyAmenitiesSection({
  propertyId,
  canManage,
}: {
  propertyId: string;
  canManage: boolean;
}) {
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadAmenities = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await apiFetch(
        `/api/properties/${propertyId}/amenities`
      );

      setAmenities(response.data ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load amenities."
      );
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    loadAmenities();
  }, [loadAmenities]);

  async function handleAdd() {
    if (!name.trim()) return;

    try {
      setSaving(true);
      setError("");

      await apiFetch(`/api/properties/${propertyId}/amenities`, {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          category: category.trim() || null,
        }),
      });

      setName("");
      setCategory("");
      await loadAmenities();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to add amenity."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(amenityId: string) {
    try {
      setDeletingId(amenityId);
      setError("");

      await apiFetch(
        `/api/properties/${propertyId}/amenities/${amenityId}`,
        { method: "DELETE" }
      );

      setAmenities((current) =>
        current.filter((amenity) => amenity.id !== amenityId)
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete amenity."
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">Amenities</h2>
      <p className="mt-1 text-sm text-slate-500">
        What this property offers guests.
      </p>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-5 text-sm text-slate-500">
          Loading amenities...
        </div>
      ) : amenities.length === 0 ? (
        <p className="mt-5 text-sm text-slate-400">
          No amenities added yet.
        </p>
      ) : (
        <div className="mt-5 flex flex-wrap gap-2">
          {amenities.map((amenity) => (
            <span
              key={amenity.id}
              className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-700"
            >
              {amenity.name}
              {amenity.category && (
                <span className="text-xs text-slate-400">
                  · {amenity.category}
                </span>
              )}

              {canManage && (
                <button
                  onClick={() => handleDelete(amenity.id)}
                  disabled={deletingId === amenity.id}
                  className="ml-1 text-slate-400 hover:text-red-600 disabled:opacity-50"
                  aria-label={`Remove ${amenity.name}`}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {canManage && (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Amenity name (e.g. Pool)"
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
          />

          <input
            type="text"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder="Category (optional)"
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
          />

          <button
            onClick={handleAdd}
            disabled={saving || !name.trim()}
            className="rounded-xl bg-[#10172a] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#18213a] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Adding..." : "Add"}
          </button>
        </div>
      )}
    </section>
  );
}
