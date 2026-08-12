"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AvailabilityCheck from "@/components/reservations/availability-check";

type Reservation = {
  id: string;
  property_id: string;
  guest_id: string;
  booking_reference: string | null;
  source: string;
  status: string | null;
  check_in: string;
  check_out: string;
  adults: number | null;
  children: number | null;
  infants: number | null;
  pets: number | null;
  nights: number | null;
  total_amount: number | null;
  cleaning_fee: number | null;
  taxes: number | null;
  currency: string | null;
  special_requests: string | null;
  property?: {
    id: string;
    title: string;
  } | null;
};

export default function EditReservationPage() {
  const params = useParams();
  const router = useRouter();

  const id = params.id as string;

  const [reservation, setReservation] =
    useState<Reservation | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [available, setAvailable] = useState<boolean | null>(null);

  const [form, setForm] = useState({
    booking_reference: "",
    source: "direct",
    status: "confirmed",
    check_in: "",
    check_out: "",
    adults: 1,
    children: 0,
    infants: 0,
    pets: 0,
    total_amount: 0,
    cleaning_fee: 0,
    taxes: 0,
    currency: "USD",
    special_requests: "",
  });

  useEffect(() => {
    async function loadReservation() {
      try {
        setLoading(true);
        setError("");

        const supabase = createClient();

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push("/auth/login");
          return;
        }

        const API_URL =
          process.env.NEXT_PUBLIC_API_URL ||
          "http://localhost:5000";

        const response = await fetch(
          `${API_URL}/api/reservations/${id}`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.error || "Failed to load reservation"
          );
        }

        const data: Reservation = result.data;

        setReservation(data);

        setForm({
          booking_reference:
            data.booking_reference || "",
          source: data.source || "direct",
          status: data.status || "confirmed",
          check_in: data.check_in || "",
          check_out: data.check_out || "",
          adults: data.adults ?? 1,
          children: data.children ?? 0,
          infants: data.infants ?? 0,
          pets: data.pets ?? 0,
          total_amount: data.total_amount ?? 0,
          cleaning_fee: data.cleaning_fee ?? 0,
          taxes: data.taxes ?? 0,
          currency: data.currency || "USD",
          special_requests:
            data.special_requests || "",
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load reservation"
        );
      } finally {
        setLoading(false);
      }
    }

    loadReservation();
  }, [id, router]);

  function updateField(
    field: string,
    value: string | number
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

    try {
      setSaving(true);
      setError("");

      const supabase = createClient();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/auth/login");
        return;
      }

      if (!form.check_in || !form.check_out) {
        throw new Error(
          "Check-in and check-out dates are required"
        );
      }

      if (form.check_out <= form.check_in) {
        throw new Error(
          "Check-out must be after check-in"
        );
      }

      // UX-only guard — the backend re-checks this same thing
      // authoritatively on submit (reservations/service.ts's
      // assertAvailableOrThrow).
      if (available === false) {
        throw new Error(
          "This property is already booked for the selected dates."
        );
      }

      const start = new Date(
        `${form.check_in}T00:00:00`
      );

      const end = new Date(
        `${form.check_out}T00:00:00`
      );

      const nights = Math.round(
        (end.getTime() - start.getTime()) /
          (1000 * 60 * 60 * 24)
      );

      const API_URL =
        process.env.NEXT_PUBLIC_API_URL ||
        "http://localhost:5000";

      const response = await fetch(
        `${API_URL}/api/reservations/${id}`,
        {
          method: "PATCH",

          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },

          body: JSON.stringify({
            booking_reference:
              form.booking_reference.trim() || null,

            source: form.source,

            status: form.status,

            check_in: form.check_in,

            check_out: form.check_out,

            adults: Number(form.adults),

            children: Number(form.children),

            infants: Number(form.infants),

            pets: Number(form.pets),

            nights,

            total_amount: Number(
              form.total_amount
            ),

            cleaning_fee: Number(
              form.cleaning_fee
            ),

            taxes: Number(form.taxes),

            currency: form.currency,

            special_requests:
              form.special_requests.trim() || null,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        // A 409 double-booking conflict carries structured details in
        // `result.data` (reservations/routes.ts) — surface them so the
        // user sees exactly what's already booked, not just a generic
        // message.
        const conflict = result.data as
          | { checkIn?: string; checkOut?: string; guestName?: string }
          | undefined;

        const message =
          conflict?.checkIn && conflict?.checkOut
            ? `${result.error} — already booked from ${conflict.checkIn} to ${conflict.checkOut}${
                conflict.guestName ? ` (Guest: ${conflict.guestName})` : ""
              }.`
            : result.error || "Failed to update reservation";

        throw new Error(message);
      }

      router.push(`/reservations/${id}`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update reservation"
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm text-slate-500">
            Loading reservation...
          </p>
        </div>
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="font-semibold text-red-800">
            Reservation not found
          </h1>

          <p className="mt-2 text-sm text-red-600">
            {error || "Unable to load this reservation."}
          </p>

          <Link
            href="/reservations"
            className="mt-4 inline-block rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white"
          >
            Back to Reservations
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-2 text-sm font-medium text-slate-500">
            Reservations
          </p>

          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Edit Reservation
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Update booking information and guest details.
          </p>
        </div>

        <Link
          href={`/reservations/${id}`}
          className="w-fit rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </Link>
      </div>

      {/* Error */}

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-700">
            {error}
          </p>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        {/* Property (read-only context — property cannot be changed
            from this form) */}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Property
          </p>

          <p className="mt-1 text-lg font-semibold text-slate-900">
            {reservation.property?.title || "Property"}
          </p>
        </section>

        {/* Booking */}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Booking Information
          </h2>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="booking_reference" className="text-sm font-medium text-slate-700">
                Booking Reference
              </label>

              <input
                id="booking_reference"
                value={form.booking_reference}
                onChange={(e) =>
                  updateField(
                    "booking_reference",
                    e.target.value
                  )
                }
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                placeholder="TEST-001"
              />
            </div>

            <div>
              <label htmlFor="source" className="text-sm font-medium text-slate-700">
                Source
              </label>

              <select
                id="source"
                value={form.source}
                onChange={(e) =>
                  updateField(
                    "source",
                    e.target.value
                  )
                }
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              >
                <option value="direct">
                  Direct
                </option>

                <option value="airbnb">
                  Airbnb
                </option>

                <option value="booking.com">
                  Booking.com
                </option>

                <option value="vrbo">
                  Vrbo
                </option>

                <option value="other">
                  Other
                </option>
              </select>
            </div>

            <div>
              <label htmlFor="status" className="text-sm font-medium text-slate-700">
                Status
              </label>

              <select
                id="status"
                value={form.status}
                onChange={(e) =>
                  updateField(
                    "status",
                    e.target.value
                  )
                }
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              >
                <option value="confirmed">
                  Confirmed
                </option>

                <option value="pending">
                  Pending
                </option>

                <option value="cancelled">
                  Cancelled
                </option>

                <option value="completed">
                  Completed
                </option>
              </select>
            </div>
          </div>
        </section>

        {/* Dates */}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Stay Dates
          </h2>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="check_in" className="text-sm font-medium text-slate-700">
                Check-in
              </label>

              <input
                id="check_in"
                type="date"
                value={form.check_in}
                onChange={(e) =>
                  updateField(
                    "check_in",
                    e.target.value
                  )
                }
                required
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label htmlFor="check_out" className="text-sm font-medium text-slate-700">
                Check-out
              </label>

              <input
                id="check_out"
                type="date"
                value={form.check_out}
                onChange={(e) =>
                  updateField(
                    "check_out",
                    e.target.value
                  )
                }
                required
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              />
            </div>
          </div>

          {reservation.property_id && (
            <AvailabilityCheck
              propertyId={reservation.property_id}
              checkIn={form.check_in}
              checkOut={form.check_out}
              excludeReservationId={reservation.id}
              onAvailabilityChange={setAvailable}
            />
          )}
        </section>

        {/* Guests */}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Guests
          </h2>

          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["adults", "Adults"],
              ["children", "Children"],
              ["infants", "Infants"],
              ["pets", "Pets"],
            ].map(([field, label]) => (
              <div key={field}>
                <label htmlFor={field} className="text-sm font-medium text-slate-700">
                  {label}
                </label>

                <input
                  id={field}
                  type="number"
                  min="0"
                  value={
                    form[
                      field as keyof typeof form
                    ] as number
                  }
                  onChange={(e) =>
                    updateField(
                      field,
                      Number(e.target.value)
                    )
                  }
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                />
              </div>
            ))}
          </div>
        </section>

        {/* Payment */}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Payment
          </h2>

          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="total_amount" className="text-sm font-medium text-slate-700">
                Total Amount
              </label>

              <input
                id="total_amount"
                type="number"
                min="0"
                step="0.01"
                value={form.total_amount}
                onChange={(e) =>
                  updateField(
                    "total_amount",
                    Number(e.target.value)
                  )
                }
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label htmlFor="cleaning_fee" className="text-sm font-medium text-slate-700">
                Cleaning Fee
              </label>

              <input
                id="cleaning_fee"
                type="number"
                min="0"
                step="0.01"
                value={form.cleaning_fee}
                onChange={(e) =>
                  updateField(
                    "cleaning_fee",
                    Number(e.target.value)
                  )
                }
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label htmlFor="taxes" className="text-sm font-medium text-slate-700">
                Taxes
              </label>

              <input
                id="taxes"
                type="number"
                min="0"
                step="0.01"
                value={form.taxes}
                onChange={(e) =>
                  updateField(
                    "taxes",
                    Number(e.target.value)
                  )
                }
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label htmlFor="currency" className="text-sm font-medium text-slate-700">
                Currency
              </label>

              <select
                id="currency"
                value={form.currency}
                onChange={(e) =>
                  updateField(
                    "currency",
                    e.target.value
                  )
                }
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              >
                <option value="USD">USD</option>
                <option value="PKR">PKR</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>
        </section>

        {/* Special Requests */}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Special Requests
          </h2>

          <textarea
            value={form.special_requests}
            onChange={(e) =>
              updateField(
                "special_requests",
                e.target.value
              )
            }
            rows={5}
            className="mt-5 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm outline-none focus:border-slate-500"
            placeholder="Any special requests..."
          />
        </section>

        {/* Actions */}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            href={`/reservations/${id}`}
            className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={saving || available === false}
            className="rounded-lg bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "Saving Changes..."
              : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}