"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type Property = {
  id: string;
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
  house_manual_url: string | null;
  status: string;
};

export default function EditPropertyPage() {
  const params = useParams();
  const router = useRouter();

  const propertyId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    title: "",
    property_type: "apartment",
    description: "",
    address: "",
    city: "",
    state: "",
    country: "",
    postal_code: "",
    latitude: "",
    longitude: "",
    bedrooms: "",
    bathrooms: "",
    beds: "",
    max_guests: "",
    check_in_time: "",
    check_out_time: "",
    house_manual_url: "",
    status: "active",
  });

  useEffect(() => {
    async function loadProperty() {
      try {
        setLoading(true);
        setError("");

        const response = await apiFetch(
          `/api/properties/${propertyId}`
        );

        const property: Property = response.data;

        setForm({
          title: property.title ?? "",
          property_type: property.property_type ?? "apartment",
          description: property.description ?? "",
          address: property.address ?? "",
          city: property.city ?? "",
          state: property.state ?? "",
          country: property.country ?? "",
          postal_code: property.postal_code ?? "",
          latitude:
            property.latitude !== null
              ? String(property.latitude)
              : "",
          longitude:
            property.longitude !== null
              ? String(property.longitude)
              : "",
          bedrooms:
            property.bedrooms !== null
              ? String(property.bedrooms)
              : "",
          bathrooms:
            property.bathrooms !== null
              ? String(property.bathrooms)
              : "",
          beds:
            property.beds !== null
              ? String(property.beds)
              : "",
          max_guests:
            property.max_guests !== null
              ? String(property.max_guests)
              : "",
          check_in_time: property.check_in_time ?? "",
          check_out_time: property.check_out_time ?? "",
          house_manual_url:
            property.house_manual_url ?? "",
          status: property.status ?? "active",
        });
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

  function updateField(
    field: keyof typeof form,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveProperty(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!form.title.trim()) {
      setError("Property title is required.");
      return;
    }

    if (!form.property_type.trim()) {
      setError("Property type is required.");
      return;
    }

    try {
      setSaving(true);

      const updates = {
        title: form.title.trim(),
        property_type: form.property_type,
        description: form.description || null,
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        country: form.country || null,
        postal_code: form.postal_code || null,

        latitude:
          form.latitude !== ""
            ? Number(form.latitude)
            : null,

        longitude:
          form.longitude !== ""
            ? Number(form.longitude)
            : null,

        bedrooms:
          form.bedrooms !== ""
            ? Number(form.bedrooms)
            : null,

        bathrooms:
          form.bathrooms !== ""
            ? Number(form.bathrooms)
            : null,

        beds:
          form.beds !== ""
            ? Number(form.beds)
            : null,

        max_guests:
          form.max_guests !== ""
            ? Number(form.max_guests)
            : null,

        check_in_time:
          form.check_in_time || null,

        check_out_time:
          form.check_out_time || null,

        house_manual_url:
          form.house_manual_url || null,

        status: form.status,
      };

      await apiFetch(
        `/api/properties/${propertyId}`,
        {
          method: "PATCH",
          body: JSON.stringify(updates),
        }
      );

      setSuccess("Property updated successfully.");

      setTimeout(() => {
        router.push(`/properties/${propertyId}`);
        router.refresh();
      }, 700);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update property."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-8">
            Loading property...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="mb-8">
          <button
            type="button"
            onClick={() =>
              router.push(`/properties/${propertyId}`)
            }
            className="mb-4 text-sm text-slate-500 hover:text-slate-900"
          >
            ← Back to Property
          </button>

          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
            Edit Property
          </h1>

          <p className="mt-2 text-slate-500">
            Update your property information.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-700">
            {success}
          </div>
        )}

        <form
          onSubmit={saveProperty}
          className="space-y-6"
        >
          {/* Basic Information */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">
              Basic Information
            </h2>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <Field
                label="Property Title *"
                value={form.title}
                onChange={(value) =>
                  updateField("title", value)
                }
                required
              />

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Property Type *
                </label>

                <select
                  value={form.property_type}
                  onChange={(e) =>
                    updateField(
                      "property_type",
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-slate-900"
                >
                  <option value="apartment">
                    Apartment
                  </option>
                  <option value="house">House</option>
                  <option value="villa">Villa</option>
                  <option value="condo">Condo</option>
                  <option value="studio">Studio</option>
                  <option value="hotel">Hotel</option>
                  <option value="guesthouse">
                    Guesthouse
                  </option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Description
                </label>

                <textarea
                  value={form.description}
                  onChange={(e) =>
                    updateField(
                      "description",
                      e.target.value
                    )
                  }
                  rows={4}
                  className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                />
              </div>
            </div>
          </section>

          {/* Location */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">
              Location
            </h2>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <Field
                  label="Address"
                  value={form.address}
                  onChange={(value) =>
                    updateField("address", value)
                  }
                />
              </div>

              <Field
                label="City"
                value={form.city}
                onChange={(value) =>
                  updateField("city", value)
                }
              />

              <Field
                label="State / Province"
                value={form.state}
                onChange={(value) =>
                  updateField("state", value)
                }
              />

              <Field
                label="Country"
                value={form.country}
                onChange={(value) =>
                  updateField("country", value)
                }
              />

              <Field
                label="Postal Code"
                value={form.postal_code}
                onChange={(value) =>
                  updateField("postal_code", value)
                }
              />
            </div>
          </section>

          {/* Property Details */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">
              Property Details
            </h2>

            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <NumberField
                label="Bedrooms"
                value={form.bedrooms}
                onChange={(value) =>
                  updateField("bedrooms", value)
                }
              />

              <NumberField
                label="Bathrooms"
                value={form.bathrooms}
                onChange={(value) =>
                  updateField("bathrooms", value)
                }
                step="0.5"
              />

              <NumberField
                label="Beds"
                value={form.beds}
                onChange={(value) =>
                  updateField("beds", value)
                }
              />

              <NumberField
                label="Maximum Guests"
                value={form.max_guests}
                onChange={(value) =>
                  updateField("max_guests", value)
                }
              />
            </div>
          </section>

          {/* Guest Information */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">
              Guest Information
            </h2>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Check-in Time
                </label>

                <input
                  type="time"
                  value={form.check_in_time}
                  onChange={(e) =>
                    updateField(
                      "check_in_time",
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Check-out Time
                </label>

                <input
                  type="time"
                  value={form.check_out_time}
                  onChange={(e) =>
                    updateField(
                      "check_out_time",
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                />
              </div>
            </div>
          </section>

          {/* Additional */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">
              Additional Information
            </h2>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <Field
                  label="House Manual URL"
                  value={form.house_manual_url}
                  onChange={(value) =>
                    updateField(
                      "house_manual_url",
                      value
                    )
                  }
                  type="url"
                />
              </div>

              <NumberField
                label="Latitude"
                value={form.latitude}
                onChange={(value) =>
                  updateField("latitude", value)
                }
                step="any"
              />

              <NumberField
                label="Longitude"
                value={form.longitude}
                onChange={(value) =>
                  updateField("longitude", value)
                }
                step="any"
              />

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Status
                </label>

                <select
                  value={form.status}
                  onChange={(e) =>
                    updateField(
                      "status",
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-slate-900"
                >
                  <option value="active">Active</option>
                  <option value="inactive">
                    Inactive
                  </option>
                </select>
              </div>
            </div>
          </section>

          {/* Actions */}
          <div className="flex justify-end gap-3 pb-10">
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                router.push(
                  `/properties/${propertyId}`
                )
              }
              className="rounded-xl border border-slate-200 bg-white px-6 py-3 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-slate-900 px-7 py-3 font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Saving Changes..."
                : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  step?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </label>

      <input
        type={type}
        value={value}
        required={required}
        step={step}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = "1",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  step?: string;
}) {
  return (
    <Field
      label={label}
      value={value}
      onChange={onChange}
      type="number"
      step={step}
    />
  );
}