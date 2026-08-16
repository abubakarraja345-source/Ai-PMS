"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type Guest = {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  language: string | null;
  passport_number: string | null;
  notes: string | null;
  vip: boolean;
  created_at: string;
  updated_at: string;
};

type GuestReservation = {
  id: string;
  property: { id: string; title: string } | null;
  booking_reference: string | null;
  source: string;
  status: string | null;
  check_in: string;
  check_out: string;
  total_amount: number | null;
  currency: string | null;
};

function reservationStatusClasses(status: string | null) {
  switch (status) {
    case "confirmed":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "pending":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "completed":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "cancelled":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-muted text-foreground/80 border-border";
  }
}

export default function GuestDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const guestId = params.id as string;

  const [guest, setGuest] = useState<Guest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [reservations, setReservations] = useState<GuestReservation[]>([]);
  const [reservationsLoading, setReservationsLoading] = useState(true);

  useEffect(() => {
    async function loadGuest() {
      try {
        setLoading(true);
        setError("");

        const response = await apiFetch(
          `/api/guests/${guestId}`
        );

        setGuest(response.data);
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

  useEffect(() => {
    async function loadReservations() {
      try {
        setReservationsLoading(true);

        const response = await apiFetch(
          `/api/reservations?guest_id=${guestId}`
        );

        setReservations(response.data ?? []);
      } catch {
        setReservations([]);
      } finally {
        setReservationsLoading(false);
      }
    }

    if (guestId) {
      loadReservations();
    }
  }, [guestId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-background px-6 py-10">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl border border-border bg-card p-8">
            Loading guest...
          </div>
        </div>
      </main>
    );
  }

  if (error || !guest) {
    return (
      <main className="min-h-screen bg-background px-6 py-10">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
            {error || "Guest not found."}
          </div>

          <button
            onClick={() => router.push("/guests")}
            className="mt-5 rounded-xl bg-primary px-5 py-3 text-white"
          >
            Back to Guests
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-6xl">

        {/* Header */}
        <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-start">
          <div>
            <button
              onClick={() => router.push("/guests")}
              className="mb-4 text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back to Guests
            </button>

            <div className="flex items-center gap-4">
              <h1 className="text-4xl font-semibold tracking-tight text-foreground">
                {guest.first_name} {guest.last_name || ""}
              </h1>

              {guest.vip && (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">
                  VIP
                </span>
              )}
            </div>

            <p className="mt-2 text-muted-foreground">
              {guest.email || "No email on file"}
            </p>
          </div>

          <div className="flex gap-3">
            {guest.phone && (
              <button
                onClick={() =>
                  router.push(`/messages?guestId=${guest.id}`)
                }
                className="rounded-xl border border-border bg-card px-6 py-3 font-medium text-foreground/80 hover:bg-muted"
              >
                Message on WhatsApp
              </button>
            )}

            <button
              onClick={() =>
                router.push(`/guests/${guest.id}/edit`)
              }
              className="rounded-xl bg-primary px-6 py-3 font-medium text-white hover:opacity-90"
            >
              Edit Guest
            </button>
          </div>
        </div>

        {/* Contact Information */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-foreground">
            Contact Information
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DetailRow label="Email" value={guest.email} />
            <DetailRow label="Phone" value={guest.phone} />
            <DetailRow label="Country" value={guest.country} />
            <DetailRow
              label="Preferred Language"
              value={guest.language}
            />
          </div>
        </section>

        {/* Reservation History */}
        <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-foreground">
            Reservation History
          </h2>

          {reservationsLoading ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Loading reservations...
            </p>
          ) : reservations.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground/80">
              No reservations for this guest yet.
            </p>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground/80">
                    <th className="pb-3 pr-4 font-medium">Property</th>
                    <th className="pb-3 pr-4 font-medium">Check-in</th>
                    <th className="pb-3 pr-4 font-medium">Check-out</th>
                    <th className="pb-3 pr-4 font-medium">Source</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.map((reservation) => (
                    <tr
                      key={reservation.id}
                      className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-muted"
                      onClick={() =>
                        (window.location.href = `/reservations/${reservation.id}`)
                      }
                    >
                      <td className="py-3 pr-4 font-medium text-foreground">
                        {reservation.property?.title ?? "Unknown property"}
                      </td>
                      <td className="py-3 pr-4 text-foreground/80">
                        {reservation.check_in}
                      </td>
                      <td className="py-3 pr-4 text-foreground/80">
                        {reservation.check_out}
                      </td>
                      <td className="py-3 pr-4 capitalize text-foreground/80">
                        {reservation.source}
                      </td>
                      <td className="py-3">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${reservationStatusClasses(reservation.status)}`}
                        >
                          {reservation.status ?? "unknown"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Documents + Notes */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-foreground">
              Travel Document
            </h2>

            <div className="mt-5">
              <DetailRow
                label="Passport Number"
                value={guest.passport_number}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-foreground">
              Notes
            </h2>

            <p className="mt-4 leading-7 text-foreground/70">
              {guest.notes || "No notes provided."}
            </p>
          </section>
        </div>

        {/* Metadata */}
        <section className="mt-6 mb-10 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-foreground">
            Record Information
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <DetailRow label="Guest ID" value={guest.id} />
            <DetailRow
              label="Created"
              value={formatDate(guest.created_at)}
            />
            <DetailRow
              label="Last Updated"
              value={formatDate(guest.updated_at)}
            />
          </div>
        </section>

      </div>
    </main>
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
