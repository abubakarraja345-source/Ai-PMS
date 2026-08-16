import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMoney as formatMoneyShared } from "@/lib/currency";
import ReservationReviewBanner from "@/components/reservations/reservation-review-banner";
import PendingApprovalBanner from "@/components/reservations/pending-approval-banner";
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
          : "bg-muted text-foreground/80 border-border";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Link
                  href="/reservations"
                  className="transition hover:text-foreground"
                >
                  Reservations
                </Link>

                <span>/</span>

                <span className="text-foreground/80">
                  Details
                </span>
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Reservation Details
              </h1>

              <p className="mt-2 text-sm text-muted-foreground">
                {reservation.booking_reference ||
                  `Reservation ${reservation.id.slice(0, 8)}`}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/reservations"
                className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground/80 shadow-sm transition hover:bg-muted"
              >
                ← Back
              </Link>

              <Link
                href={`/reservations/${reservation.id}/edit`}
                className="rounded-xl bg-background px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
              >
                Edit Reservation
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Suspense fallback={null}>
          <PendingApprovalBanner />
        </Suspense>

        <ReservationReviewBanner
          reservationId={reservation.id}
          initialNeedsReview={reservation.needs_review}
        />

        {/* Top Summary */}
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
              Booking Reference
            </p>

            <p className="mt-2 text-xl font-bold text-foreground">
              {reservation.booking_reference || "—"}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
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

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
              Booking Source
            </p>

            <p className="mt-2 text-xl font-bold capitalize text-foreground">
              {reservation.source || "—"}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Stay Information */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Stay Information
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Reservation dates and property information
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">
                  Check-in
                </p>

                <p className="mt-1 text-base font-semibold text-foreground">
                  {formatDate(reservation.check_in)}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  Check-out
                </p>

                <p className="mt-1 text-base font-semibold text-foreground">
                  {formatDate(reservation.check_out)}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  Nights
                </p>

                <p className="mt-1 text-base font-semibold text-foreground">
                  {reservation.nights ?? "—"}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  Property
                </p>

                <p className="mt-1 text-base font-semibold text-foreground">
                  {reservation.property?.title ||
                    "Property"}
                </p>

                <p className="mt-1 break-all text-xs text-muted-foreground/80">
                  {reservation.property_id}
                </p>
              </div>
            </div>
          </div>

          {/* Guest */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground">
              Guest
            </h2>

            <div className="mt-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-lg font-bold text-foreground/80">
                {guestName.charAt(0).toUpperCase()}
              </div>

              <h3 className="mt-4 text-lg font-semibold text-foreground">
                {guestName}
              </h3>

              {reservation.guest?.email && (
                <p className="mt-1 break-all text-sm text-muted-foreground">
                  {reservation.guest.email}
                </p>
              )}

              {reservation.guest?.first_name === "Imported (Airbnb)" && (
                <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                  Guest details unavailable through this connection.
                </p>
              )}
            </div>

            <div className="mt-6 border-t border-border pt-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                Guest ID
              </p>

              <p className="mt-1 break-all text-xs text-muted-foreground">
                {reservation.guest_id}
              </p>
            </div>
          </div>
        </div>

        {/* Guest Counts */}
        <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">
            Guests
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            {totalGuests} guest
            {totalGuests !== 1 ? "s" : ""} staying at the property
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-muted p-4">
              <p className="text-sm text-muted-foreground">
                Adults
              </p>

              <p className="mt-1 text-2xl font-bold text-foreground">
                {reservation.adults ?? 0}
              </p>
            </div>

            <div className="rounded-xl bg-muted p-4">
              <p className="text-sm text-muted-foreground">
                Children
              </p>

              <p className="mt-1 text-2xl font-bold text-foreground">
                {reservation.children ?? 0}
              </p>
            </div>

            <div className="rounded-xl bg-muted p-4">
              <p className="text-sm text-muted-foreground">
                Infants
              </p>

              <p className="mt-1 text-2xl font-bold text-foreground">
                {reservation.infants ?? 0}
              </p>
            </div>

            <div className="rounded-xl bg-muted p-4">
              <p className="text-sm text-muted-foreground">
                Pets
              </p>

              <p className="mt-1 text-2xl font-bold text-foreground">
                {reservation.pets ?? 0}
              </p>
            </div>
          </div>
        </div>

        {/* Payment */}
        <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Payment Summary
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Financial details for this reservation
              </p>
            </div>

            <CurrencyBadge code={reservation.currency} variant="financial" />
          </div>

          <div className="mt-6 rounded-2xl bg-primary px-6 py-8 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              Total Amount
            </p>

            <p className="mt-2 text-4xl font-bold tabular-nums text-white">
              {formatMoney(
                reservation.total_amount,
                reservation.currency
              )}
            </p>

            <p className="mt-1 text-xs text-muted-foreground/80">
              Recorded reservation value
            </p>
          </div>

          <div className="mt-5 divide-y divide-slate-100 overflow-hidden rounded-xl border border-border">
            <div className="flex items-center justify-between px-5 py-3.5">
              <span className="text-sm text-foreground/70">Cleaning Fee</span>
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {formatMoney(
                  reservation.cleaning_fee,
                  reservation.currency
                )}
              </span>
            </div>

            <div className="flex items-center justify-between px-5 py-3.5">
              <span className="text-sm text-foreground/70">Taxes</span>
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {formatMoney(
                  reservation.taxes,
                  reservation.currency
                )}
              </span>
            </div>
          </div>

          <p className="mt-3 text-xs text-muted-foreground/80">
            Cleaning fee and taxes are recorded independently and are not
            combined into the total amount above.
          </p>
        </div>

        {/* Special Requests */}
        <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">
            Special Requests
          </h2>

          {reservation.special_requests ? (
            <p className="mt-3 whitespace-pre-wrap rounded-xl bg-muted p-4 text-sm leading-6 text-foreground/70">
              {reservation.special_requests}
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground/80">
              No special requests were added.
            </p>
          )}
        </div>

        {/* Metadata */}
        <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground/80">
            Reservation Information
          </h2>

          <div className="mt-4 grid gap-4 text-xs text-muted-foreground sm:grid-cols-2">
            <div>
              <p className="font-medium text-muted-foreground/80">
                Reservation ID
              </p>

              <p className="mt-1 break-all">
                {reservation.id}
              </p>
            </div>

            <div>
              <p className="font-medium text-muted-foreground/80">
                Organization ID
              </p>

              <p className="mt-1 break-all">
                {reservation.organization_id}
              </p>
            </div>

            <div>
              <p className="font-medium text-muted-foreground/80">
                Created
              </p>

              <p className="mt-1">
                {new Date(
                  reservation.created_at
                ).toLocaleString()}
              </p>
            </div>

            <div>
              <p className="font-medium text-muted-foreground/80">
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
            className="rounded-xl border border-border bg-card px-5 py-3 text-sm font-medium text-foreground/80 shadow-sm transition hover:bg-muted"
          >
            Back to Reservations
          </Link>

          <Link
            href={`/reservations/${reservation.id}/edit`}
            className="rounded-xl bg-background px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
          >
            Edit Reservation
          </Link>
        </div>
      </main>
    </div>
  );
}