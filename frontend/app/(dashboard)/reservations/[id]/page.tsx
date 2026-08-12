import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMoney as formatMoneyShared } from "@/lib/currency";
import ReservationReviewBanner from "@/components/reservations/reservation-review-banner";
import CurrencyBadge from "@/components/shared/currency-badge";

type Reservation = {
  id: string;
  organization_id: string;
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
  needs_review: boolean;

  created_at: string;
  updated_at: string;

  property?: {
    id: string;
    title: string;
  } | null;

  guest?: {
    id: string;
    first_name: string;
    last_name: string | null;
    email: string | null;
  } | null;
};

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ReservationViewPage({
  params,
}: Props) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    notFound();
  }

  const backendUrl =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  const response = await fetch(
    `${backendUrl}/api/reservations/${id}`,
    {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    if (response.status === 404) {
      notFound();
    }

    throw new Error("Failed to fetch reservation");
  }

  const result = await response.json();

  if (!result.success || !result.data) {
    notFound();
  }

  const reservation: Reservation = result.data;

  const formatDate = (date: string) => {
    if (!date) return "—";

    return new Date(`${date}T00:00:00`).toLocaleDateString(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
      }
    );
  };

  const formatMoney = (
    amount: number | null,
    currency: string | null
  ) => {
    return formatMoneyShared(amount ?? 0, currency);
  };

  const status = (
    reservation.status || "confirmed"
  ).toLowerCase();

  const guestName = reservation.guest
    ? `${reservation.guest.first_name} ${
        reservation.guest.last_name || ""
      }`.trim()
    : "Guest";

  const totalGuests =
    (reservation.adults ?? 0) +
    (reservation.children ?? 0) +
    (reservation.infants ?? 0);

  const statusClasses =
    status === "confirmed"
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : status === "cancelled" || status === "canceled"
        ? "bg-red-50 text-red-700 border-red-100"
        : status === "pending"
          ? "bg-amber-50 text-amber-700 border-amber-100"
          : "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
                <Link
                  href="/reservations"
                  className="transition hover:text-slate-900"
                >
                  Reservations
                </Link>

                <span>/</span>

                <span className="text-slate-700">
                  Details
                </span>
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                Reservation Details
              </h1>

              <p className="mt-2 text-sm text-slate-500">
                {reservation.booking_reference ||
                  `Reservation ${reservation.id.slice(0, 8)}`}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/reservations"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                ← Back
              </Link>

              <Link
                href={`/reservations/${reservation.id}/edit`}
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
              >
                Edit Reservation
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        <ReservationReviewBanner
          reservationId={reservation.id}
          initialNeedsReview={reservation.needs_review}
        />

        {/* Top Summary */}
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Booking Reference
            </p>

            <p className="mt-2 text-xl font-bold text-slate-900">
              {reservation.booking_reference || "—"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Status
            </p>

            <div className="mt-2">
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold capitalize ${statusClasses}`}
              >
                {status}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Booking Source
            </p>

            <p className="mt-2 text-xl font-bold capitalize text-slate-900">
              {reservation.source || "—"}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Stay Information */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Stay Information
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Reservation dates and property information
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-sm text-slate-500">
                  Check-in
                </p>

                <p className="mt-1 text-base font-semibold text-slate-900">
                  {formatDate(reservation.check_in)}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">
                  Check-out
                </p>

                <p className="mt-1 text-base font-semibold text-slate-900">
                  {formatDate(reservation.check_out)}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">
                  Nights
                </p>

                <p className="mt-1 text-base font-semibold text-slate-900">
                  {reservation.nights ?? "—"}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">
                  Property
                </p>

                <p className="mt-1 text-base font-semibold text-slate-900">
                  {reservation.property?.title ||
                    "Property"}
                </p>

                <p className="mt-1 break-all text-xs text-slate-400">
                  {reservation.property_id}
                </p>
              </div>
            </div>
          </div>

          {/* Guest */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Guest
            </h2>

            <div className="mt-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-lg font-bold text-slate-700">
                {guestName.charAt(0).toUpperCase()}
              </div>

              <h3 className="mt-4 text-lg font-semibold text-slate-900">
                {guestName}
              </h3>

              {reservation.guest?.email && (
                <p className="mt-1 break-all text-sm text-slate-500">
                  {reservation.guest.email}
                </p>
              )}
            </div>

            <div className="mt-6 border-t border-slate-100 pt-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Guest ID
              </p>

              <p className="mt-1 break-all text-xs text-slate-500">
                {reservation.guest_id}
              </p>
            </div>
          </div>
        </div>

        {/* Guest Counts */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Guests
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {totalGuests} guest
            {totalGuests !== 1 ? "s" : ""} staying at the property
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">
                Adults
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-900">
                {reservation.adults ?? 0}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">
                Children
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-900">
                {reservation.children ?? 0}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">
                Infants
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-900">
                {reservation.infants ?? 0}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">
                Pets
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-900">
                {reservation.pets ?? 0}
              </p>
            </div>
          </div>
        </div>

        {/* Payment */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Payment Summary
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Financial details for this reservation
              </p>
            </div>

            <CurrencyBadge code={reservation.currency} variant="expanded" />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-5">
              <p className="text-sm text-slate-500">
                Total Amount
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-900">
                {formatMoney(
                  reservation.total_amount,
                  reservation.currency
                )}
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-5">
              <p className="text-sm text-slate-500">
                Cleaning Fee
              </p>

              <p className="mt-2 text-xl font-semibold text-slate-900">
                {formatMoney(
                  reservation.cleaning_fee,
                  reservation.currency
                )}
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-5">
              <p className="text-sm text-slate-500">
                Taxes
              </p>

              <p className="mt-2 text-xl font-semibold text-slate-900">
                {formatMoney(
                  reservation.taxes,
                  reservation.currency
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Special Requests */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Special Requests
          </h2>

          {reservation.special_requests ? (
            <p className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              {reservation.special_requests}
            </p>
          ) : (
            <p className="mt-3 text-sm text-slate-400">
              No special requests were added.
            </p>
          )}
        </div>

        {/* Metadata */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700">
            Reservation Information
          </h2>

          <div className="mt-4 grid gap-4 text-xs text-slate-500 sm:grid-cols-2">
            <div>
              <p className="font-medium text-slate-400">
                Reservation ID
              </p>

              <p className="mt-1 break-all">
                {reservation.id}
              </p>
            </div>

            <div>
              <p className="font-medium text-slate-400">
                Organization ID
              </p>

              <p className="mt-1 break-all">
                {reservation.organization_id}
              </p>
            </div>

            <div>
              <p className="font-medium text-slate-400">
                Created
              </p>

              <p className="mt-1">
                {new Date(
                  reservation.created_at
                ).toLocaleString()}
              </p>
            </div>

            <div>
              <p className="font-medium text-slate-400">
                Last Updated
              </p>

              <p className="mt-1">
                {new Date(
                  reservation.updated_at
                ).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="mt-8 flex flex-wrap justify-end gap-3">
          <Link
            href="/reservations"
            className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Back to Reservations
          </Link>

          <Link
            href={`/reservations/${reservation.id}/edit`}
            className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
          >
            Edit Reservation
          </Link>
        </div>
      </main>
    </div>
  );
}