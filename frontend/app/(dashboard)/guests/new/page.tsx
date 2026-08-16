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
    <main className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <button
            type="button"
            onClick={() => router.push("/guests")}
            className="mb-4 text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to Guests
          </button>

          <h1 className="text-4xl font-semibold tracking-tight text-foreground">
            Add Guest
          </h1>

          <p className="mt-2 text-muted-foreground">
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
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-foreground">
              Basic Information
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              The guest&apos;s name and contact details.
            </p>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="first_name" className="mb-2 block text-sm font-medium text-foreground/80">
                  First Name *
                </label>

                <input
                  id="first_name"
                  type="text"
                  value={form.first_name}
                  onChange={(e) =>
                    updateField("first_name", e.target.value)
                  }
                  placeholder="e.g. Sarah"
                  className="w-full rounded-xl border border-border px-4 py-3 outline-none transition focus:border-primary"
                  required
                />
              </div>

              <div>
                <label htmlFor="last_name" className="mb-2 block text-sm font-medium text-foreground/80">
                  Last Name
                </label>

                <input
                  id="last_name"
                  type="text"
                  value={form.last_name}
                  onChange={(e) =>
                    updateField("last_name", e.target.value)
                  }
                  placeholder="e.g. Khan"
                  className="w-full rounded-xl border border-border px-4 py-3 outline-none focus:border-primary"
                />
              </div>

              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-medium text-foreground/80">
                  Email
                </label>

                <input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    updateField("email", e.target.value)
                  }
                  placeholder="guest@example.com"
                  className="w-full rounded-xl border border-border px-4 py-3 outline-none focus:border-primary"
                />
              </div>

              <div>
                <label htmlFor="phone" className="mb-2 block text-sm font-medium text-foreground/80">
                  Phone
                </label>

                <input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) =>
                    updateField("phone", e.target.value)
                  }
                  placeholder="+92 300 1234567"
                  className="w-full rounded-xl border border-border px-4 py-3 outline-none focus:border-primary"
                />
              </div>
            </div>
          </section>

          {/* Additional Details */}
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-foreground">
              Additional Details
            </h2>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="country" className="mb-2 block text-sm font-medium text-foreground/80">
                  Country
                </label>

                <input
                  id="country"
                  type="text"
                  value={form.country}
                  onChange={(e) =>
                    updateField("country", e.target.value)
                  }
                  placeholder="Pakistan"
                  className="w-full rounded-xl border border-border px-4 py-3 outline-none focus:border-primary"
                />
              </div>

              <div>
                <label htmlFor="language" className="mb-2 block text-sm font-medium text-foreground/80">
                  Preferred Language
                </label>

                <input
                  id="language"
                  type="text"
                  value={form.language}
                  onChange={(e) =>
                    updateField("language", e.target.value)
                  }
                  placeholder="English"
                  className="w-full rounded-xl border border-border px-4 py-3 outline-none focus:border-primary"
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="passport_number" className="mb-2 block text-sm font-medium text-foreground/80">
                  Passport Number
                </label>

                <input
                  id="passport_number"
                  type="text"
                  value={form.passport_number}
                  onChange={(e) =>
                    updateField(
                      "passport_number",
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-border px-4 py-3 outline-none focus:border-primary"
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="notes" className="mb-2 block text-sm font-medium text-foreground/80">
                  Notes
                </label>

                <textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) =>
                    updateField("notes", e.target.value)
                  }
                  placeholder="Internal notes about this guest..."
                  rows={4}
                  className="w-full resize-none rounded-xl border border-border px-4 py-3 outline-none focus:border-primary"
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
                  className="h-5 w-5 rounded border-border"
                />

                <label
                  htmlFor="vip"
                  className="text-sm font-medium text-foreground/80"
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
              className="rounded-xl border border-border bg-card px-6 py-3 font-medium text-foreground/80 transition hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-primary px-7 py-3 font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Creating Guest..." : "Create Guest"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
