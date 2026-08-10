"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type Guest = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  language: string | null;
  passport_number: string | null;
  notes: string | null;
  vip: boolean;
};

export default function EditGuestPage() {
  const params = useParams();
  const router = useRouter();

  const guestId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    country: "",
    language: "",
    passport_number: "",
    notes: "",
    vip: false,
  });

  useEffect(() => {
    async function loadGuest() {
      try {
        setLoading(true);
        setError("");

        const response = await apiFetch(
          `/api/guests/${guestId}`
        );

        const guest: Guest = response.data;

        setForm({
          first_name: guest.first_name ?? "",
          last_name: guest.last_name ?? "",
          email: guest.email ?? "",
          phone: guest.phone ?? "",
          country: guest.country ?? "",
          language: guest.language ?? "",
          passport_number: guest.passport_number ?? "",
          notes: guest.notes ?? "",
          vip: guest.vip ?? false,
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load guest."
        );
      } finally {
        setLoading(false);
      }
    }

    if (guestId) {
      loadGuest();
    }
  }, [guestId]);

  function updateField(
    field: keyof typeof form,
    value: string | boolean
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveGuest(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!form.first_name.trim()) {
      setError("First name is required.");
      return;
    }

    try {
      setSaving(true);

      const updates = {
        first_name: form.first_name.trim(),
        last_name: form.last_name || null,
        email: form.email || null,
        phone: form.phone || null,
        country: form.country || null,
        language: form.language || null,
        passport_number: form.passport_number || null,
        notes: form.notes || null,
        vip: form.vip,
      };

      await apiFetch(`/api/guests/${guestId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });

      setSuccess("Guest updated successfully.");

      setTimeout(() => {
        router.push(`/guests/${guestId}`);
        router.refresh();
      }, 700);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update guest."
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
            Loading guest...
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
              router.push(`/guests/${guestId}`)
            }
            className="mb-4 text-sm text-slate-500 hover:text-slate-900"
          >
            ← Back to Guest
          </button>

          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
            Edit Guest
          </h1>

          <p className="mt-2 text-slate-500">
            Update this guest&apos;s profile information.
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
          onSubmit={saveGuest}
          className="space-y-6"
        >
          {/* Basic Information */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">
              Basic Information
            </h2>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <Field
                label="First Name *"
                value={form.first_name}
                onChange={(value) =>
                  updateField("first_name", value)
                }
                required
              />

              <Field
                label="Last Name"
                value={form.last_name}
                onChange={(value) =>
                  updateField("last_name", value)
                }
              />

              <Field
                label="Email"
                type="email"
                value={form.email}
                onChange={(value) =>
                  updateField("email", value)
                }
              />

              <Field
                label="Phone"
                type="tel"
                value={form.phone}
                onChange={(value) =>
                  updateField("phone", value)
                }
              />
            </div>
          </section>

          {/* Additional Details */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">
              Additional Details
            </h2>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <Field
                label="Country"
                value={form.country}
                onChange={(value) =>
                  updateField("country", value)
                }
              />

              <Field
                label="Preferred Language"
                value={form.language}
                onChange={(value) =>
                  updateField("language", value)
                }
              />

              <div className="md:col-span-2">
                <Field
                  label="Passport Number"
                  value={form.passport_number}
                  onChange={(value) =>
                    updateField("passport_number", value)
                  }
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Notes
                </label>

                <textarea
                  value={form.notes}
                  onChange={(e) =>
                    updateField("notes", e.target.value)
                  }
                  rows={4}
                  className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="vip"
                  checked={form.vip}
                  onChange={(e) =>
                    updateField("vip", e.target.checked)
                  }
                  className="h-5 w-5 rounded border-slate-300"
                />

                <label
                  htmlFor="vip"
                  className="text-sm font-medium text-slate-700"
                >
                  Mark as VIP guest
                </label>
              </div>
            </div>
          </section>

          {/* Actions */}
          <div className="flex justify-end gap-3 pb-10">
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                router.push(`/guests/${guestId}`)
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
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
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
      />
    </div>
  );
}
