"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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

type CleaningTask = {
  id: string;
  property_id: string;
  reservation_id: string | null;
  scheduled_date: string | null;
  assigned_to: string | null;
  priority: string;
  notes: string | null;
};

export default function EditCleaningTaskPage() {
  const params = useParams();
  const router = useRouter();

  const taskId = params.id as string;

  const [properties, setProperties] = useState<
    PropertyOption[]
  >([]);
  const [reservations, setReservations] = useState<
    ReservationOption[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    property_id: "",
    reservation_id: "",
    scheduled_date: "",
    assigned_to: "",
    priority: "normal",
    notes: "",
  });

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError("");

        const [taskRes, propertiesRes, reservationsRes] =
          await Promise.all([
            apiFetch(`/api/cleaning/${taskId}`),
            apiFetch("/api/properties"),
            apiFetch("/api/reservations"),
          ]);

        const task: CleaningTask = taskRes.data;

        setProperties(propertiesRes.data ?? []);
        setReservations(reservationsRes.data ?? []);

        setForm({
          property_id: task.property_id ?? "",
          reservation_id: task.reservation_id ?? "",
          scheduled_date: task.scheduled_date ?? "",
          assigned_to: task.assigned_to ?? "",
          priority: task.priority ?? "normal",
          notes: task.notes ?? "",
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load cleaning task."
        );
      } finally {
        setLoading(false);
      }
    }

    if (taskId) {
      loadData();
    }
  }, [taskId]);

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

  async function saveTask(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!form.property_id) {
      setError("Property is required.");
      return;
    }

    try {
      setSaving(true);

      const updates = {
        property_id: form.property_id,
        reservation_id: form.reservation_id || null,
        scheduled_date: form.scheduled_date || null,
        assigned_to: form.assigned_to || null,
        priority: form.priority,
        notes: form.notes || null,
      };

      await apiFetch(`/api/cleaning/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });

      setSuccess("Cleaning task updated successfully.");

      setTimeout(() => {
        router.push(`/cleaning/${taskId}`);
        router.refresh();
      }, 700);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update cleaning task."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-8">
            Loading cleaning task...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <button
            type="button"
            onClick={() =>
              router.push(`/cleaning/${taskId}`)
            }
            className="mb-4 text-sm text-slate-500 hover:text-slate-900"
          >
            ← Back to Task
          </button>

          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
            Edit Cleaning Task
          </h1>

          <p className="mt-2 text-slate-500">
            Status changes are handled from the task detail
            page using the contextual action buttons.
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

        <form onSubmit={saveTask} className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">
              Task Details
            </h2>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Property *
                </label>

                <select
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
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Reservation
                </label>

                <select
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
                  <option value="">None</option>
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
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Scheduled Date
                </label>

                <input
                  type="date"
                  value={form.scheduled_date}
                  onChange={(e) =>
                    updateField(
                      "scheduled_date",
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Priority
                </label>

                <select
                  value={form.priority}
                  onChange={(e) =>
                    updateField("priority", e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-slate-900"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Assigned To
                </label>

                <input
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
            </div>
          </section>

          <div className="flex justify-end gap-3 pb-10">
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                router.push(`/cleaning/${taskId}`)
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
              {saving ? "Saving Changes..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
