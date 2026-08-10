"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

export default function NewGuestPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
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

  function updateField(
    field: keyof typeof form,
    value: string | boolean
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function createGuest(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setError("");
    setSuccess("");

    if (!form.first_name.trim()) {
      setError("First name is required.");
      setLoading(false);
      return;
    }

    try {
      const payload = {
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

      await apiFetch("/api/guests", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setSuccess("Guest created successfully.");

      setTimeout(() => {
        router.push("/guests");
        router.refresh();
      }, 700);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create guest."
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
            onClick={() => router.push("/guests")}
            className="mb-4 text-sm text-slate-500 hover:text-slate-900"
          >
            ← Back to Guests
          </button>

          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
            Add Guest
          </h1>

          <p className="mt-2 text-slate-500">
            Add a new guest profile to your PMS.
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

        <form onSubmit={createGuest} className="space-y-6">
          {/* Basic Information */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">
              Basic Information
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              The guest&apos;s name and contact details.
            </p>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  First Name *
                </label>

                <input
                  type="text"
                  value={form.first_name}
                  onChange={(e) =>
                    updateField("first_name", e.target.value)
                  }
                  placeholder="e.g. Sarah"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-900"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Last Name
                </label>

                <input
                  type="text"
                  value={form.last_name}
                  onChange={(e) =>
                    updateField("last_name", e.target.value)
                  }
                  placeholder="e.g. Khan"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Email
                </label>

                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    updateField("email", e.target.value)
                  }
                  placeholder="guest@example.com"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Phone
                </label>

                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) =>
                    updateField("phone", e.target.value)
                  }
                  placeholder="+92 300 1234567"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                />
              </div>
            </div>
          </section>

          {/* Additional Details */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">
              Additional Details
            </h2>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Country
                </label>

                <input
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
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Preferred Language
                </label>

                <input
                  type="text"
                  value={form.language}
                  onChange={(e) =>
                    updateField("language", e.target.value)
                  }
                  placeholder="English"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Passport Number
                </label>

                <input
                  type="text"
                  value={form.passport_number}
                  onChange={(e) =>
                    updateField(
                      "passport_number",
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
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
                  placeholder="Internal notes about this guest..."
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
          <div className="flex items-center justify-end gap-3 pb-10">
            <button
              type="button"
              onClick={() => router.push("/guests")}
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
              {loading ? "Creating Guest..." : "Create Guest"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
