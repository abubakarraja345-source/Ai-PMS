"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

export default function NewPropertyPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
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

  function updateField(
    field: keyof typeof form,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function createProperty(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setError("");
    setSuccess("");

    if (!form.title.trim()) {
      setError("Property title is required.");
      setLoading(false);
      return;
    }

    if (!form.property_type.trim()) {
      setError("Property type is required.");
      setLoading(false);
      return;
    }

    try {
      const payload = {
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

      await apiFetch("/api/properties", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setSuccess("Property created successfully.");

      setTimeout(() => {
        router.push("/properties");
        router.refresh();
      }, 700);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create property."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <button
            type="button"
            onClick={() => router.push("/properties")}
            className="mb-4 text-sm text-slate-500 hover:text-slate-900"
          >
            ← Back to Properties
          </button>

          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
            Add Property
          </h1>

          <p className="mt-2 text-slate-500">
            Add a new property to your PMS portfolio.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-700">
            {success}
          </div>
        )}

        <form onSubmit={createProperty} className="space-y-6">
          {/* Basic Information */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">
              Basic Information
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              The basic information guests and your team will see.
            </p>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="title" className="mb-2 block text-sm font-medium text-slate-700">
                  Property Title *
                </label>

                <input
                  id="title"
                  type="text"
                  value={form.title}
                  onChange={(e) =>
                    updateField("title", e.target.value)
                  }
                  placeholder="e.g. Luxury Lahore Apartment"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-900"
                  required
                />
              </div>

              <div>
                <label htmlFor="property_type" className="mb-2 block text-sm font-medium text-slate-700">
                  Property Type *
                </label>

                <select
                  id="property_type"
                  value={form.property_type}
                  onChange={(e) =>
                    updateField(
                      "property_type",
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-slate-900"
                  required
                >
                  <option value="apartment">Apartment</option>
                  <option value="house">House</option>
                  <option value="villa">Villa</option>
                  <option value="condo">Condo</option>
                  <option value="studio">Studio</option>
                  <option value="hotel">Hotel</option>
                  <option value="guesthouse">Guesthouse</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label htmlFor="description" className="mb-2 block text-sm font-medium text-slate-700">
                  Description
                </label>

                <textarea
                  id="description"
                  value={form.description}
                  onChange={(e) =>
                    updateField(
                      "description",
                      e.target.value
                    )
                  }
                  placeholder="Describe the property..."
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

            <p className="mt-1 text-sm text-slate-500">
              Where is this property located?
            </p>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label htmlFor="address" className="mb-2 block text-sm font-medium text-slate-700">
                  Address
                </label>

                <input
                  id="address"
                  type="text"
                  value={form.address}
                  onChange={(e) =>
                    updateField("address", e.target.value)
                  }
                  placeholder="Street address"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label htmlFor="city" className="mb-2 block text-sm font-medium text-slate-700">
                  City
                </label>

                <input
                  id="city"
                  type="text"
                  value={form.city}
                  onChange={(e) =>
                    updateField("city", e.target.value)
                  }
                  placeholder="Lahore"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label htmlFor="state" className="mb-2 block text-sm font-medium text-slate-700">
                  State / Province
                </label>

                <input
                  id="state"
                  type="text"
                  value={form.state}
                  onChange={(e) =>
                    updateField("state", e.target.value)
                  }
                  placeholder="Punjab"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label htmlFor="prop_country" className="mb-2 block text-sm font-medium text-slate-700">
                  Country
                </label>

                <input
                  id="prop_country"
                  type="text"
                  value={form.country}
                  onChange={(e) =>
                    updateField("country", e.target.value)
                  }
                  placeholder="Pakistan"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label htmlFor="postal_code" className="mb-2 block text-sm font-medium text-slate-700">
                  Postal Code
                </label>

                <input
                  id="postal_code"
                  type="text"
                  value={form.postal_code}
                  onChange={(e) =>
                    updateField(
                      "postal_code",
                      e.target.value
                    )
                  }
                  placeholder="54000"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                />
              </div>
            </div>
          </section>

          {/* Property Details */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">
              Property Details
            </h2>

            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <NumberField
                id="bedrooms"
                label="Bedrooms"
                value={form.bedrooms}
                onChange={(value) =>
                  updateField("bedrooms", value)
                }
              />

              <NumberField
                id="bathrooms"
                label="Bathrooms"
                value={form.bathrooms}
                onChange={(value) =>
                  updateField("bathrooms", value)
                }
              />

              <NumberField
                id="beds"
                label="Beds"
                value={form.beds}
                onChange={(value) =>
                  updateField("beds", value)
                }
              />

              <NumberField
                id="max_guests"
                label="Maximum Guests"
                value={form.max_guests}
                onChange={(value) =>
                  updateField("max_guests", value)
                }
              />
            </div>
          </section>

          {/* Check-in / Check-out */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">
              Guest Information
            </h2>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="check_in_time" className="mb-2 block text-sm font-medium text-slate-700">
                  Check-in Time
                </label>

                <input
                  id="check_in_time"
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
                <label htmlFor="check_out_time" className="mb-2 block text-sm font-medium text-slate-700">
                  Check-out Time
                </label>

                <input
                  id="check_out_time"
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
                <label htmlFor="house_manual_url" className="mb-2 block text-sm font-medium text-slate-700">
                  House Manual URL
                </label>

                <input
                  id="house_manual_url"
                  type="url"
                  value={form.house_manual_url}
                  onChange={(e) =>
                    updateField(
                      "house_manual_url",
                      e.target.value
                    )
                  }
                  placeholder="https://example.com/manual"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                />
              </div>

              <NumberField
                id="latitude"
                label="Latitude"
                value={form.latitude}
                onChange={(value) =>
                  updateField("latitude", value)
                }
                step="any"
              />

              <NumberField
                id="longitude"
                label="Longitude"
                value={form.longitude}
                onChange={(value) =>
                  updateField("longitude", value)
                }
                step="any"
              />

              <div>
                <label htmlFor="status" className="mb-2 block text-sm font-medium text-slate-700">
                  Status
                </label>

                <select
                  id="status"
                  value={form.status}
                  onChange={(e) =>
                    updateField("status", e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-slate-900"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </section>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pb-10">
            <button
              type="button"
              onClick={() => router.push("/properties")}
              disabled={loading}
              className="rounded-xl border border-slate-200 bg-white px-6 py-3 font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-slate-900 px-7 py-3 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Creating Property..." : "Create Property"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  step = "1",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  step?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </label>

      <input
        id={id}
        type="number"
        min="0"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
      />
    </div>
  );
}