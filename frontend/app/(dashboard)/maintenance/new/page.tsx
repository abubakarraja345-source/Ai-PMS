"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

interface PropertyOption {
  id: string;
  title: string;
}

interface ReservationOption {
  id: string;
  property_id: string;
  check_in: string;
  check_out: string;
  booking_reference: string | null;
  guest?: {
    first_name: string;
    last_name: string | null;
  } | null;
}

export default function NewMaintenanceTicketPage() {
  const router = useRouter();

  const [properties, setProperties] = useState<
    PropertyOption[]
  >([]);
  const [reservations, setReservations] = useState<
    ReservationOption[]
  >([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    property_id: "",
    reservation_id: "",
    title: "",
    category: "",
    priority: "medium",
    description: "",
    assigned_to: "",
    estimated_cost: "",
  });

  useEffect(() => {
    async function loadOptions() {
      try {
        const [propertiesRes, reservationsRes] =
          await Promise.all([
            apiFetch("/api/properties"),
            apiFetch("/api/reservations"),
          ]);

        setProperties(propertiesRes.data ?? []);
        setReservations(reservationsRes.data ?? []);
      } catch {
        // Non-fatal — dropdowns simply won't populate.
      }
    }

    loadOptions();
  }, []);

  const reservationsForProperty = useMemo(() => {
    if (!form.property_id) return [];
    return reservations.filter(
      (r) => r.property_id === form.property_id
    );
  }, [reservations, form.property_id]);

  function updateField(
    field: keyof typeof form,
    value: string
  ) {
    setForm((current) => {
      const next = { ...current, [field]: value };

      if (
        field === "property_id" &&
        current.reservation_id
      ) {
        const stillValid = reservations.some(
          (r) =>
            r.id === current.reservation_id &&
            r.property_id === value
        );

        if (!stillValid) {
          next.reservation_id = "";
        }
      }

      return next;
    });
  }

  async function createTicket(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setLoading(true);
    setError("");
    setSuccess("");

    if (!form.property_id) {
      setError("Property is required.");
      setLoading(false);
      return;
    }

    if (!form.title.trim()) {
      setError("Title is required.");
      setLoading(false);
      return;
    }

    try {
      const payload = {
        property_id: form.property_id,
        reservation_id: form.reservation_id || null,
        title: form.title.trim(),
        category: form.category || null,
        priority: form.priority,
        description: form.description || null,
        assigned_to: form.assigned_to || null,
        estimated_cost:
          form.estimated_cost !== ""
            ? Number(form.estimated_cost)
            : null,
      };

      await apiFetch("/api/maintenance", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setSuccess("Maintenance ticket created successfully.");

      setTimeout(() => {
        router.push("/maintenance");
        router.refresh();
      }, 700);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create maintenance ticket."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <button
            type="button"
            onClick={() => router.push("/maintenance")}
            className="mb-4 text-sm text-slate-500 hover:text-slate-900"
          >
            ← Back to Maintenance
          </button>

          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
            New Maintenance Ticket
          </h1>

          <p className="mt-2 text-slate-500">
            Report a property maintenance issue.
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

        <form onSubmit={createTicket} className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">
              Ticket Details
            </h2>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label htmlFor="title" className="mb-2 block text-sm font-medium text-slate-700">
                  Title *
                </label>

                <input
                  id="title"
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) =>
                    updateField("title", e.target.value)
                  }
                  placeholder="e.g. Leaking faucet in master bath"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label htmlFor="property_id" className="mb-2 block text-sm font-medium text-slate-700">
                  Property *
                </label>

                <select
                  id="property_id"
                  required
                  value={form.property_id}
                  onChange={(e) =>
                    updateField(
                      "property_id",
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-slate-900"
                >
                  <option value="">Select property</option>
                  {properties.map((property) => (
                    <option
                      key={property.id}
                      value={property.id}
                    >
                      {property.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="reservation_id" className="mb-2 block text-sm font-medium text-slate-700">
                  Reservation
                </label>

                <select
                  id="reservation_id"
                  value={form.reservation_id}
                  onChange={(e) =>
                    updateField(
                      "reservation_id",
                      e.target.value
                    )
                  }
                  disabled={!form.property_id}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="">
                    {form.property_id
                      ? "None"
                      : "Select a property first"}
                  </option>
                  {reservationsForProperty.map(
                    (reservation) => (
                      <option
                        key={reservation.id}
                        value={reservation.id}
                      >
                        {reservation.booking_reference
                          ? `${reservation.booking_reference} · `
                          : ""}
                        {reservation.guest
                          ? `${reservation.guest.first_name} ${
                              reservation.guest.last_name ??
                              ""
                            }`.trim()
                          : "Unknown guest"}{" "}
                        ({reservation.check_in} →{" "}
                        {reservation.check_out})
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label htmlFor="category" className="mb-2 block text-sm font-medium text-slate-700">
                  Category
                </label>

                <input
                  id="category"
                  type="text"
                  value={form.category}
                  onChange={(e) =>
                    updateField("category", e.target.value)
                  }
                  placeholder="e.g. plumbing, electrical, HVAC"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label htmlFor="priority" className="mb-2 block text-sm font-medium text-slate-700">
                  Priority
                </label>

                <select
                  id="priority"
                  value={form.priority}
                  onChange={(e) =>
                    updateField("priority", e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-slate-900"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label htmlFor="assigned_to" className="mb-2 block text-sm font-medium text-slate-700">
                  Assigned To
                </label>

                <input
                  id="assigned_to"
                  type="text"
                  value={form.assigned_to}
                  onChange={(e) =>
                    updateField(
                      "assigned_to",
                      e.target.value
                    )
                  }
                  placeholder="Staff member ID or name"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label htmlFor="estimated_cost" className="mb-2 block text-sm font-medium text-slate-700">
                  Estimated Cost
                </label>

                <input
                  id="estimated_cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.estimated_cost}
                  onChange={(e) =>
                    updateField(
                      "estimated_cost",
                      e.target.value
                    )
                  }
                  placeholder="0.00"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                />
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
                  placeholder="Describe the issue..."
                  rows={4}
                  className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                />
              </div>
            </div>
          </section>

          <div className="flex items-center justify-end gap-3 pb-10">
            <button
              type="button"
              onClick={() => router.push("/maintenance")}
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
              {loading
                ? "Creating Ticket..."
                : "Create Ticket"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
