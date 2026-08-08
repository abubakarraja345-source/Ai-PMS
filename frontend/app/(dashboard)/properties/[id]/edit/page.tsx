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
  bedrooms: number | null;
  bathrooms: number | null;
  beds: number | null;
  max_guests: number | null;
  check_in_time: string | null;
  check_out_time: string | null;
  wifi_name: string | null;
  wifi_password: string | null;
  status: string | null;
};

export default function EditPropertyPage() {
  const params = useParams();
  const router = useRouter();

  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    title: "",
    property_type: "apartment",
    description: "",
    address: "",
    city: "",
    state: "",
    country: "",
    postal_code: "",
    bedrooms: "",
    bathrooms: "",
    beds: "",
    max_guests: "",
    check_in_time: "",
    check_out_time: "",
    wifi_name: "",
    wifi_password: "",
    status: "active",
  });

  useEffect(() => {
    if (id) {
      loadProperty();
    }
  }, [id]);

  async function loadProperty() {
    try {
      setLoading(true);
      setError("");

      const response = await apiFetch(
        `/api/properties/${id}`
      );

      if (!response?.success || !response?.data) {
        throw new Error(
          response?.error || "Property not found"
        );
      }

      const property: Property = response.data;

      setForm({
        title: property.title ?? "",
        property_type:
          property.property_type ?? "apartment",
        description: property.description ?? "",
        address: property.address ?? "",
        city: property.city ?? "",
        state: property.state ?? "",
        country: property.country ?? "",
        postal_code: property.postal_code ?? "",
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
        check_in_time:
          property.check_in_time ?? "",
        check_out_time:
          property.check_out_time ?? "",
        wifi_name: property.wifi_name ?? "",
        wifi_password: property.wifi_password ?? "",
        status: property.status ?? "active",
      });
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load property"
      );
    } finally {
      setLoading(false);
    }
  }

  function updateField(
    field: keyof typeof form,
    value: string
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaving(true);
    setError("");

    try {
      const response = await apiFetch(
        `/api/properties/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            title: form.title,
            property_type: form.property_type,
            description: form.description || null,
            address: form.address || null,
            city: form.city || null,
            state: form.state || null,
            country: form.country || null,
            postal_code: form.postal_code || null,
            bedrooms: form.bedrooms
              ? Number(form.bedrooms)
              : null,
            bathrooms: form.bathrooms
              ? Number(form.bathrooms)
              : null,
            beds: form.beds
              ? Number(form.beds)
              : null,
            max_guests: form.max_guests
              ? Number(form.max_guests)
              : null,
            check_in_time:
              form.check_in_time || null,
            check_out_time:
              form.check_out_time || null,
            wifi_name: form.wifi_name || null,
            wifi_password:
              form.wifi_password || null,
            status: form.status,
          }),
        }
      );

      if (!response?.success) {
        throw new Error(
          response?.error || "Unable to update property"
        );
      }

      router.push(`/properties/${id}`);
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to update property"
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen p-8">
        <div className="mx-auto max-w-4xl">
          <p className="text-gray-500">
            Loading property...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl">
        <button
          type="button"
          onClick={() =>
            router.push(`/properties/${id}`)
          }
          className="mb-6 text-sm text-gray-500 hover:text-black"
        >
          ← Back to Property
        </button>

        <h1 className="text-3xl font-semibold">
          Edit Property
        </h1>

        <p className="mt-2 text-gray-500">
          Update your property information.
        </p>

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-8"
        >
          {/* Basic Information */}
          <section className="rounded-xl border p-6">
            <h2 className="text-xl font-semibold">
              Basic Information
            </h2>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium">
                  Property Title *
                </label>

                <input
                  required
                  value={form.title}
                  onChange={(e) =>
                    updateField(
                      "title",
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border px-4 py-3 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Property Type
                </label>

                <select
                  value={form.property_type}
                  onChange={(e) =>
                    updateField(
                      "property_type",
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border px-4 py-3"
                >
                  <option value="apartment">
                    Apartment
                  </option>
                  <option value="house">
                    House
                  </option>
                  <option value="villa">
                    Villa
                  </option>
                  <option value="studio">
                    Studio
                  </option>
                  <option value="condo">
                    Condo
                  </option>
                  <option value="hotel">
                    Hotel
                  </option>
                  <option value="other">
                    Other
                  </option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
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
                  className="w-full rounded-lg border px-4 py-3"
                >
                  <option value="active">
                    Active
                  </option>
                  <option value="inactive">
                    Inactive
                  </option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium">
                  Description
                </label>

                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) =>
                    updateField(
                      "description",
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border px-4 py-3"
                />
              </div>
            </div>
          </section>

          {/* Location */}
          <section className="rounded-xl border p-6">
            <h2 className="text-xl font-semibold">
              Location
            </h2>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium">
                  Address
                </label>

                <input
                  value={form.address}
                  onChange={(e) =>
                    updateField(
                      "address",
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  City
                </label>

                <input
                  value={form.city}
                  onChange={(e) =>
                    updateField(
                      "city",
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  State / Province
                </label>

                <input
                  value={form.state}
                  onChange={(e) =>
                    updateField(
                      "state",
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Country
                </label>

                <input
                  value={form.country}
                  onChange={(e) =>
                    updateField(
                      "country",
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Postal Code
                </label>

                <input
                  value={form.postal_code}
                  onChange={(e) =>
                    updateField(
                      "postal_code",
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border px-4 py-3"
                />
              </div>
            </div>
          </section>

          {/* Capacity */}
          <section className="rounded-xl border p-6">
            <h2 className="text-xl font-semibold">
              Capacity
            </h2>

            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <NumberInput
                label="Bedrooms"
                value={form.bedrooms}
                onChange={(value) =>
                  updateField("bedrooms", value)
                }
              />

              <NumberInput
                label="Bathrooms"
                value={form.bathrooms}
                onChange={(value) =>
                  updateField("bathrooms", value)
                }
              />

              <NumberInput
                label="Beds"
                value={form.beds}
                onChange={(value) =>
                  updateField("beds", value)
                }
              />

              <NumberInput
                label="Max Guests"
                value={form.max_guests}
                onChange={(value) =>
                  updateField("max_guests", value)
                }
              />
            </div>
          </section>

          {/* Times */}
          <section className="rounded-xl border p-6">
            <h2 className="text-xl font-semibold">
              Check-in & Check-out
            </h2>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">
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
                  className="w-full rounded-lg border px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
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
                  className="w-full rounded-lg border px-4 py-3"
                />
              </div>
            </div>
          </section>

          {/* Wi-Fi */}
          <section className="rounded-xl border p-6">
            <h2 className="text-xl font-semibold">
              Wi-Fi
            </h2>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Wi-Fi Name
                </label>

                <input
                  value={form.wifi_name}
                  onChange={(e) =>
                    updateField(
                      "wifi_name",
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Wi-Fi Password
                </label>

                <input
                  type="password"
                  value={form.wifi_password}
                  onChange={(e) =>
                    updateField(
                      "wifi_password",
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border px-4 py-3"
                />
              </div>
            </div>
          </section>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() =>
                router.push(`/properties/${id}`)
              }
              className="rounded-lg border px-6 py-3"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-black px-6 py-3 text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium">
        {label}
      </label>

      <input
        type="number"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border px-4 py-3"
      />
    </div>
  );
}