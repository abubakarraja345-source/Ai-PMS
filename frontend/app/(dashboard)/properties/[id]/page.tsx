"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import PropertyImagesSection from "@/components/properties/property-images-section";
import PropertyAmenitiesSection from "@/components/properties/property-amenities-section";
import PropertyRulesSection from "@/components/properties/property-rules-section";
import PropertyDocumentsSection from "@/components/properties/property-documents-section";
import PropertyChannelLinksSection from "@/components/properties/property-channel-links-section";
import PropertyCurrentBookingSection from "@/components/properties/property-current-booking-section";
import PropertyIcalExportSection from "@/components/properties/property-ical-export-section";
import PropertyAssignmentsSection from "@/components/properties/property-assignments-section";
import CurrencyDisplayCard from "@/components/shared/currency-display-card";

type Property = {
  id: string;
  organization_id: string;
  title: string;
  property_type: string;
  description: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  beds: number | null;
  max_guests: number | null;
  check_in_time: string | null;
  check_out_time: string | null;
  wifi_name: string | null;
  wifi_password: string | null;
  house_manual_url: string | null;
  status: string;
  currency: string | null;
  created_at: string;
  updated_at: string;
};

export default function PropertyDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const propertyId = params.id as string;

  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orgDefaultCurrency, setOrgDefaultCurrency] = useState("USD");
  const [canManage, setCanManage] = useState(false);

  useEffect(() => {
    async function loadProperty() {
      try {
        setLoading(true);
        setError("");

        const response = await apiFetch(
          `/api/properties/${propertyId}`
        );

        setProperty(response.data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load property."
        );
      } finally {
        setLoading(false);
      }
    }

    if (propertyId) {
      loadProperty();
    }
  }, [propertyId]);

  useEffect(() => {
    async function loadRole() {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const response = await apiFetch("/api/organization/members");
        const self = (response.data ?? []).find(
          (member: { userId: string }) =>
            member.userId === session?.user?.id
        );

        setCanManage(
          self?.role === "owner" || self?.role === "company_admin"
        );
      } catch {
        setCanManage(false);
      }
    }

    loadRole();
  }, []);

  useEffect(() => {
    async function loadOrgCurrency() {
      try {
        const response = await apiFetch("/api/organization/settings");
        setOrgDefaultCurrency(response.data?.currency ?? "USD");
      } catch {
        // Non-fatal — "Effective currency" falls back to showing the
        // property's own override (if any) without the org-default
        // context text.
      }
    }

    loadOrgCurrency();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-background px-6 py-10">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl border border-border bg-card p-8">
            Loading property...
          </div>
        </div>
      </main>
    );
  }

  if (error || !property) {
    return (
      <main className="min-h-screen bg-background px-6 py-10">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
            {error || "Property not found."}
          </div>

          <button
            onClick={() => router.push("/properties")}
            className="mt-5 rounded-xl bg-primary px-5 py-3 text-white"
          >
            Back to Properties
          </button>
        </div>
      </main>
    );
  }

  const location = [
    property.city,
    property.state,
    property.country,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-6xl">

        {/* Header */}
        <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-start">
          <div>
            <button
              onClick={() => router.push("/properties")}
              className="mb-4 text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back to Properties
            </button>

            <div className="flex items-center gap-4">
              <h1 className="text-4xl font-semibold tracking-tight text-foreground">
                {property.title}
              </h1>

              <span
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  property.status === "active"
                    ? "bg-green-50 text-green-700"
                    : "bg-muted text-foreground/70"
                }`}
              >
                {property.status}
              </span>
            </div>

            <p className="mt-2 capitalize text-muted-foreground">
              {property.property_type}
              {location ? ` · ${location}` : ""}
            </p>
          </div>

          <button
            onClick={() =>
              router.push(`/properties/${property.id}/edit`)
            }
            className="rounded-xl bg-primary px-6 py-3 font-medium text-white hover:opacity-90"
          >
            Edit Property
          </button>
        </div>

        <PropertyImagesSection
          propertyId={property.id}
          canManage={canManage}
        />

        <PropertyCurrentBookingSection propertyId={property.id} />

        {/* Overview */}
        <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-foreground">
            Property Overview
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Key information about this property.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoCard
              label="Bedrooms"
              value={property.bedrooms ?? "—"}
            />

            <InfoCard
              label="Bathrooms"
              value={property.bathrooms ?? "—"}
            />

            <InfoCard
              label="Beds"
              value={property.beds ?? "—"}
            />

            <InfoCard
              label="Maximum Guests"
              value={property.max_guests ?? "—"}
            />
          </div>
        </section>

        {/* Financial Profile */}
        <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                Financial Profile
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Currency used for this property&apos;s reservations and
                financial records.
              </p>
            </div>

            {canManage && (
              <button
                onClick={() =>
                  router.push(`/properties/${property.id}/edit`)
                }
                className="text-sm font-medium text-foreground/80 hover:text-foreground"
              >
                Edit Settings →
              </button>
            )}
          </div>

          <div className="mt-5">
            <CurrencyDisplayCard
              code={property.currency ?? orgDefaultCurrency}
              sourceLabel={
                property.currency
                  ? "Custom property currency"
                  : "Inherited from organization"
              }
              sourceTone={property.currency ? "override" : "inherited"}
              helperText="Used for new reservations. Existing reservations keep the currency they were created with."
            />
          </div>
        </section>

        {/* Description + Location */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">

          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-foreground">
              Description
            </h2>

            <p className="mt-4 leading-7 text-foreground/70">
              {property.description || "No description provided."}
            </p>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-foreground">
              Location
            </h2>

            <div className="mt-5 space-y-4">
              <DetailRow
                label="Address"
                value={property.address}
              />

              <DetailRow
                label="City"
                value={property.city}
              />

              <DetailRow
                label="State"
                value={property.state}
              />

              <DetailRow
                label="Country"
                value={property.country}
              />

              <DetailRow
                label="Postal Code"
                value={property.postal_code}
              />
            </div>
          </section>
        </div>

        {/* Guest Information */}
        <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-foreground">
            Guest Information
          </h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <InfoCard
              label="Check-in"
              value={property.check_in_time || "Not specified"}
            />

            <InfoCard
              label="Check-out"
              value={property.check_out_time || "Not specified"}
            />
          </div>
        </section>

        <PropertyAmenitiesSection
          propertyId={property.id}
          canManage={canManage}
        />

        <PropertyRulesSection
          propertyId={property.id}
          canManage={canManage}
        />

        {/* Wi-Fi / Manual */}
        <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-foreground">
            Property Resources
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <DetailRow
              label="Wi-Fi Name"
              value={property.wifi_name}
            />

            <DetailRow
              label="Wi-Fi Password"
              value={
                property.wifi_password
                  ? "••••••••"
                  : null
              }
            />

            <div>
              <p className="text-sm text-muted-foreground">
                House Manual
              </p>

              {property.house_manual_url ? (
                <a
                  href={property.house_manual_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block text-sm font-medium text-foreground underline"
                >
                  Open House Manual
                </a>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground/80">
                  Not provided
                </p>
              )}
            </div>
          </div>
        </section>

        <PropertyDocumentsSection
          propertyId={property.id}
          canManage={canManage}
        />

        <PropertyChannelLinksSection
          propertyId={property.id}
          canManage={canManage}
        />

        <PropertyIcalExportSection
          propertyId={property.id}
          canManage={canManage}
        />

        <PropertyAssignmentsSection propertyId={property.id} />

        {/* Coordinates */}
        <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-foreground">
            Location Coordinates
          </h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <InfoCard
              label="Latitude"
              value={property.latitude ?? "—"}
            />

            <InfoCard
              label="Longitude"
              value={property.longitude ?? "—"}
            />
          </div>
        </section>

        {/* Metadata */}
        <section className="mt-6 mb-10 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-foreground">
            Record Information
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <DetailRow
              label="Property ID"
              value={property.id}
            />

            <DetailRow
              label="Created"
              value={formatDate(property.created_at)}
            />

            <DetailRow
              label="Last Updated"
              value={formatDate(property.updated_at)}
            />
          </div>
        </section>

      </div>
    </main>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl bg-muted p-5">
      <p className="text-sm text-muted-foreground">
        {label}
      </p>

      <p className="mt-2 text-2xl font-semibold text-foreground">
        {value}
      </p>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-medium text-foreground">
        {value || "Not provided"}
      </p>
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}