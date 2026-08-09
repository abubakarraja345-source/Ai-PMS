import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
  created_at: string;
  updated_at: string;
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

  // Get current authenticated user/session
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
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(amount ?? 0);
  };

  const status = reservation.status || "confirmed";

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-2 text-sm font-medium text-slate-500">
            Reservations
          </p>

          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Reservation Details
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            {reservation.booking_reference ||
              `Reservation ${reservation.id}`}
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/reservations"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Back
          </Link>

          <Link
            href={`/reservations/${reservation.id}/edit`}
            className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Edit Reservation
          </Link>
        </div>
      </div>

      {/* Status */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-500">
              Booking Reference
            </p>

            <p className="mt-1 text-xl font-semibold text-slate-900">
              {reservation.booking_reference || "—"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">
              Status
            </span>

            <span
              className={`rounded-full px-3 py-1 text-sm font-medium capitalize ${
                status === "confirmed"
                  ? "bg-green-50 text-green-700"
                  : status === "cancelled"
                    ? "bg-red-50 text-red-700"
                    : "bg-yellow-50 text-yellow-700"
              }`}
            >
              {status}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Stay Information */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900">
            Stay Information
          </h2>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-sm text-slate-500">
                Check-in
              </p>

              <p className="mt-1 font-medium text-slate-900">
                {formatDate(reservation.check_in)}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-500">
                Check-out
              </p>

              <p className="mt-1 font-medium text-slate-900">
                {formatDate(reservation.check_out)}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-500">
                Nights
              </p>

              <p className="mt-1 font-medium text-slate-900">
                {reservation.nights ?? "—"}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-500">
                Booking Source
              </p>

              <p className="mt-1 font-medium capitalize text-slate-900">
                {reservation.source}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-500">
                Property ID
              </p>

              <p className="mt-1 break-all font-medium text-slate-900">
                {reservation.property_id}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-500">
                Guest ID
              </p>

              <p className="mt-1 break-all font-medium text-slate-900">
                {reservation.guest_id}
              </p>
            </div>
          </div>
        </div>

        {/* Guests */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Guests
          </h2>

          <div className="mt-6 space-y-5">
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">
                Adults
              </span>

              <span className="font-medium text-slate-900">
                {reservation.adults ?? 0}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-sm text-slate-500">
                Children
              </span>

              <span className="font-medium text-slate-900">
                {reservation.children ?? 0}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-sm text-slate-500">
                Infants
              </span>

              <span className="font-medium text-slate-900">
                {reservation.infants ?? 0}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-sm text-slate-500">
                Pets
              </span>

              <span className="font-medium text-slate-900">
                {reservation.pets ?? 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Payment Summary
        </h2>

        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          <div>
            <p className="text-sm text-slate-500">
              Total Amount
            </p>

            <p className="mt-1 text-2xl font-bold text-slate-900">
              {formatMoney(
                reservation.total_amount,
                reservation.currency
              )}
            </p>
          </div>

          <div>
            <p className="text-sm text-slate-500">
              Cleaning Fee
            </p>

            <p className="mt-1 text-lg font-semibold text-slate-900">
              {formatMoney(
                reservation.cleaning_fee,
                reservation.currency
              )}
            </p>
          </div>

          <div>
            <p className="text-sm text-slate-500">
              Taxes
            </p>

            <p className="mt-1 text-lg font-semibold text-slate-900">
              {formatMoney(
                reservation.taxes,
                reservation.currency
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Special Requests */}
      {reservation.special_requests && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Special Requests
          </h2>

          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
            {reservation.special_requests}
          </p>
        </div>
      )}

      {/* Metadata */}
      <div className="mt-6 text-xs text-slate-400">
        <p>Reservation ID: {reservation.id}</p>

        <p className="mt-1">
          Created:{" "}
          {new Date(reservation.created_at).toLocaleString()}
        </p>

        <p>
          Updated:{" "}
          {new Date(reservation.updated_at).toLocaleString()}
        </p>
      </div>
    </div>
  );
}