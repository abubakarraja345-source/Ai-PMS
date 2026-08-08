"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface Property {
  id: string;
  title: string;
  property_type: string;
  city: string | null;
  country: string | null;
  bedrooms: number | null;
  beds: number | null;
  max_guests: number | null;
  status: string;
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function loadProperties() {
    try {
      setLoading(true);
      setError("");

      const response = await apiFetch("/api/properties");

      setProperties(response.data ?? []);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to load properties"
      );
    } finally {
      setLoading(false);
    }
  }

  async function deleteProperty(propertyId: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this property?\n\nThis action cannot be undone."
    );

    if (!confirmed) return;

    try {
      setDeletingId(propertyId);
      setError("");

      await apiFetch(`/api/properties/${propertyId}`, {
        method: "DELETE",
      });

      // Remove it immediately from the UI
      setProperties((current) =>
        current.filter((property) => property.id !== propertyId)
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to delete property"
      );
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    loadProperties();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 p-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-5xl font-semibold text-slate-950">
            Properties
          </h1>

          <p className="mt-3 text-lg text-slate-500">
            Manage your properties and listings.
          </p>
        </div>

        <button
          className="rounded-xl bg-[#10172a] px-6 py-4 text-white hover:bg-[#18213a]"
          onClick={() => {
            window.location.href = "/properties/new";
          }}
        >
          + Add Property
        </button>
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-10 text-slate-500">
          Loading properties...
        </div>
      ) : properties.length === 0 ? (
        <div className="mt-10 rounded-2xl border bg-white p-10 text-center">
          <h2 className="text-2xl font-semibold text-slate-900">
            No properties yet
          </h2>

          <p className="mt-2 text-slate-500">
            Add your first property to start managing your portfolio.
          </p>
        </div>
      ) : (
        <div className="mt-12 grid gap-7 md:grid-cols-2 xl:grid-cols-3">
          {properties.map((property) => (
            <div
              key={property.id}
              className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-950">
                    {property.title}
                  </h2>

                  <p className="mt-2 text-lg text-slate-500">
                    {property.property_type}
                  </p>
                </div>

                <span className="rounded-full bg-green-50 px-4 py-2 text-sm font-medium text-green-600">
                  {property.status}
                </span>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-6">
                <div>
                  <p className="text-slate-400">Location</p>
                  <p className="mt-2 text-slate-800">
                    {property.city || "—"},{" "}
                    {property.country || "—"}
                  </p>
                </div>

                <div>
                  <p className="text-slate-400">Guests</p>
                  <p className="mt-2 text-slate-800">
                    {property.max_guests ?? "—"}
                  </p>
                </div>

                <div>
                  <p className="text-slate-400">Bedrooms</p>
                  <p className="mt-2 text-slate-800">
                    {property.bedrooms ?? "—"}
                  </p>
                </div>

                <div>
                  <p className="text-slate-400">Beds</p>
                  <p className="mt-2 text-slate-800">
                    {property.beds ?? "—"}
                  </p>
                </div>
              </div>

              {/* ACTIONS */}
              <div className="mt-8 grid grid-cols-3 gap-3">
                <button
                  onClick={() =>
                    (window.location.href = `/properties/${property.id}`)
                  }
                  className="rounded-xl border border-slate-200 px-4 py-3 text-slate-800 hover:bg-slate-50"
                >
                  View
                </button>

                <button
                  onClick={() =>
                    (window.location.href = `/properties/${property.id}/edit`)
                  }
                  className="rounded-xl bg-[#10172a] px-4 py-3 text-white hover:bg-[#18213a]"
                >
                  Edit
                </button>

                <button
                  onClick={() => deleteProperty(property.id)}
                  disabled={deletingId === property.id}
                  className="rounded-xl border border-red-200 px-4 py-3 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deletingId === property.id
                    ? "Deleting..."
                    : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}