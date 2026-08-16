"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  Home,
  Hotel,
  Warehouse,
  MapPin,
  Users,
  BedDouble,
  DoorOpen,
  Eye,
  Pencil,
  Trash2,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { usePermission } from "@/lib/permission-context";
import { SkeletonCardGrid } from "@/components/shared/skeleton";

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

const TYPE_ICON: Record<string, typeof Home> = {
  apartment: Building2,
  condo: Building2,
  studio: Building2,
  house: Home,
  villa: Home,
  guesthouse: Home,
  hotel: Hotel,
};

function typeIcon(propertyType: string) {
  return TYPE_ICON[propertyType] ?? Warehouse;
}

function statusClasses(status: string) {
  switch (status.toLowerCase()) {
    case "active":
      return "bg-success/10 text-success border-success/30";
    case "inactive":
      return "bg-muted text-muted-foreground border-border";
    case "maintenance":
      return "bg-warning/10 text-warning border-warning/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export default function PropertiesPage() {
  const { can } = usePermission();
  const canCreate = can("properties.create");
  const canUpdate = can("properties.update");
  const canDelete = can("properties.delete");

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadProperties = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await apiFetch(`/api/properties?page=${page}`);

      setProperties(response.data ?? []);
      setTotalPages(response.meta?.totalPages ?? 1);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to load properties"
      );
    } finally {
      setLoading(false);
    }
  }, [page]);

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
  }, [loadProperties]);

  return (
    <main className="min-h-screen bg-background p-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-5xl font-semibold text-foreground">
            Properties
          </h1>

          <p className="mt-3 text-lg text-muted-foreground">
            Manage your properties and listings.
          </p>
        </div>

        {canCreate && (
          <button
            className="rounded-xl bg-gradient-to-r from-primary to-accent px-6 py-4 text-white shadow-lg shadow-black/10 transition hover:opacity-90"
            onClick={() => {
              window.location.href = "/properties/new";
            }}
          >
            + Add Property
          </button>
        )}
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-10">
          <SkeletonCardGrid count={6} />
        </div>
      ) : properties.length === 0 ? (
        <div className="mt-10 rounded-2xl border bg-card p-10 text-center">
          <h2 className="text-2xl font-semibold text-foreground">
            No properties yet
          </h2>

          <p className="mt-2 text-muted-foreground">
            Add your first property to start managing your portfolio.
          </p>
        </div>
      ) : (
        <div className="mt-12 grid gap-7 md:grid-cols-2 xl:grid-cols-3">
          {properties.map((property) => {
            const Icon = typeIcon(property.property_type);

            return (
              <div
                key={property.id}
                className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
              >
                {/* Header banner */}
                <div className="relative flex h-28 items-center justify-center overflow-hidden bg-gradient-to-br from-primary/90 to-accent/90">
                  <Icon
                    size={56}
                    className="text-white/25 transition-transform duration-300 group-hover:scale-110"
                  />

                  <span
                    className={`absolute right-3 top-3 rounded-full border px-3 py-1 text-xs font-medium capitalize backdrop-blur-sm ${statusClasses(
                      property.status
                    )}`}
                  >
                    {property.status}
                  </span>
                </div>

                <div className="p-6">
                  <h2 className="truncate text-xl font-semibold text-foreground">
                    {property.title}
                  </h2>

                  <p className="mt-1 flex items-center gap-1.5 text-sm capitalize text-muted-foreground">
                    <Icon size={14} className="shrink-0" />
                    {property.property_type}
                  </p>

                  <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin size={14} className="shrink-0" />
                    {property.city || "—"}
                    {property.country ? `, ${property.country}` : ""}
                  </p>

                  {/* Quick stats */}
                  <div className="mt-5 grid grid-cols-3 gap-2 rounded-xl bg-muted/60 p-3">
                    <div className="flex flex-col items-center gap-1 text-center">
                      <Users size={16} className="text-primary" />
                      <span className="text-sm font-semibold text-foreground">
                        {property.max_guests ?? "—"}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Guests
                      </span>
                    </div>

                    <div className="flex flex-col items-center gap-1 border-x border-border text-center">
                      <DoorOpen size={16} className="text-primary" />
                      <span className="text-sm font-semibold text-foreground">
                        {property.bedrooms ?? "—"}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Bedrooms
                      </span>
                    </div>

                    <div className="flex flex-col items-center gap-1 text-center">
                      <BedDouble size={16} className="text-primary" />
                      <span className="text-sm font-semibold text-foreground">
                        {property.beds ?? "—"}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Beds
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-5 grid grid-cols-3 gap-2">
                    <button
                      onClick={() =>
                        (window.location.href = `/properties/${property.id}`)
                      }
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-sm font-medium text-foreground/80 transition hover:border-primary/40 hover:bg-muted"
                    >
                      <Eye size={14} />
                      View
                    </button>

                    <button
                      onClick={() =>
                        (window.location.href = `/properties/${property.id}/edit`)
                      }
                      disabled={!canUpdate}
                      title={canUpdate ? undefined : "You don't have permission to perform this action."}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-primary to-accent px-3 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Pencil size={14} />
                      Edit
                    </button>

                    <button
                      onClick={() => deleteProperty(property.id)}
                      disabled={deletingId === property.id || !canDelete}
                      title={canDelete ? undefined : "You don't have permission to perform this action."}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-destructive/30 px-3 py-2.5 text-sm font-medium text-destructive transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                      {deletingId === property.id ? "..." : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PaginationControls
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </main>
  );
}