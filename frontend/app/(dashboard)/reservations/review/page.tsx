"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { PaginationControls } from "@/components/shared/pagination-controls";

interface PropertyOption {
  id: string;
  title: string;
}

interface GuestSummary {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
}

interface PropertySummary {
  id: string;
  title: string;
}

interface ReviewReservation {
  id: string;
  property?: PropertySummary | null;
  guest?: GuestSummary | null;
  booking_reference: string | null;
  source: string;
  status: string | null;
  check_in: string;
  check_out: string;
  needs_review: boolean;
  created_at: string;
  updated_at: string;
}

const SOURCES = ["direct", "airbnb", "booking.com", "vrbo", "other"];

function getGuestName(guest: GuestSummary | null | undefined) {
  if (!guest) return "Unknown guest";
  return `${guest.first_name} ${guest.last_name ?? ""}`.trim();
}

function getStatusBadgeClasses(status: string | null) {
  switch (status) {
    case "confirmed":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "pending":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "cancelled":
      return "bg-red-50 text-red-700 border-red-200";
    case "completed":
      return "bg-blue-50 text-blue-700 border-blue-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

function sourceLabel(source: string, bookingReference: string | null) {
  const isImported = !!bookingReference && bookingReference.startsWith("ical:");
  const label = source === "booking.com" ? "Booking.com" : source;
  return isImported ? `${label} (iCal)` : label;
}

export default function ReservationReviewPage() {
  const router = useRouter();

  const [reservations, setReservations] = useState<ReviewReservation[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [propertyFilter, setPropertyFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [startFilter, setStartFilter] = useState("");
  const [endFilter, setEndFilter] = useState("");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    async function loadProperties() {
      try {
        const response = await apiFetch("/api/properties?limit=100");
        setProperties(response.data ?? []);
      } catch {
        // Non-fatal — the property filter simply won't populate.
      }
    }

    loadProperties();
  }, []);

  // Any filter change invalidates the current page — page 1 of a new
  // filtered set is the only page guaranteed to exist.
  useEffect(() => {
    setPage(1);
  }, [propertyFilter, sourceFilter, statusFilter, startFilter, endFilter]);

  const loadReviewQueue = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();
      params.set("needs_review", "true");
      if (propertyFilter !== "all") params.set("property_id", propertyFilter);
      if (sourceFilter !== "all") params.set("source", sourceFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (startFilter) params.set("start", startFilter);
      if (endFilter) params.set("end", endFilter);
      params.set("page", String(page));

      const response = await apiFetch(`/api/reservations?${params.toString()}`);

      setReservations(response.data ?? []);
      setTotalPages(response.meta?.totalPages ?? 1);
      setTotal(response.meta?.total ?? 0);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load review queue."
      );
    } finally {
      setLoading(false);
    }
  }, [propertyFilter, sourceFilter, statusFilter, startFilter, endFilter, page]);

  useEffect(() => {
    loadReviewQueue();
  }, [loadReviewQueue]);

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-10">
      <div>
        <h1 className="text-3xl font-semibold text-slate-950 md:text-5xl">
          Reservation Review
        </h1>

        <p className="mt-2 text-slate-500 md:mt-3 md:text-lg">
          Reservations requiring attention before they&apos;re considered
          fully reconciled.
        </p>
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <select
          value={propertyFilter}
          onChange={(e) => setPropertyFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400"
        >
          <option value="all">All properties</option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.title}
            </option>
          ))}
        </select>

        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400"
        >
          <option value="all">All sources</option>
          {SOURCES.map((source) => (
            <option key={source} value={source}>
              {source === "booking.com" ? "Booking.com" : source}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400"
        >
          <option value="all">All statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <input
          type="date"
          value={startFilter}
          onChange={(e) => setStartFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400"
        />

        <span className="self-center text-sm text-slate-400">to</span>

        <input
          type="date"
          value={endFilter}
          onChange={(e) => setEndFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400"
        />

        <button
          onClick={loadReviewQueue}
          disabled={loading}
          className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {/* List */}
      <div className="mt-6 overflow-hidden rounded-xl border bg-white shadow-sm">
        {loading ? (
          <div className="p-12 text-center">
            <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
            <p className="mt-4 text-sm text-slate-500">
              Loading review queue...
            </p>
          </div>
        ) : reservations.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
              ✓
            </div>
            <h3 className="mt-4 font-medium text-slate-900">
              You&apos;re all caught up.
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              There are no reservations requiring review.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="px-5 py-4 font-medium text-slate-600">
                    Property
                  </th>
                  <th className="px-5 py-4 font-medium text-slate-600">
                    Guest
                  </th>
                  <th className="px-5 py-4 font-medium text-slate-600">
                    Dates
                  </th>
                  <th className="px-5 py-4 font-medium text-slate-600">
                    Source
                  </th>
                  <th className="px-5 py-4 font-medium text-slate-600">
                    Reference
                  </th>
                  <th className="px-5 py-4 font-medium text-slate-600">
                    Status
                  </th>
                  <th className="px-5 py-4 font-medium text-slate-600">
                    Needs Review
                  </th>
                  <th className="px-5 py-4 font-medium text-slate-600">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {reservations.map((reservation) => (
                  <tr
                    key={reservation.id}
                    className="border-b last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">
                        {reservation.property?.title ?? "Unknown property"}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-800">
                        {getGuestName(reservation.guest)}
                      </p>
                      {reservation.guest?.email && (
                        <p className="mt-1 max-w-[180px] truncate text-xs text-slate-500">
                          {reservation.guest.email}
                        </p>
                      )}
                    </td>

                    <td className="px-5 py-4 text-slate-700">
                      {reservation.check_in}
                      <p className="mt-1 text-xs text-slate-500">
                        → {reservation.check_out}
                      </p>
                    </td>

                    <td className="px-5 py-4 capitalize text-slate-700">
                      {sourceLabel(
                        reservation.source,
                        reservation.booking_reference
                      )}
                    </td>

                    <td className="px-5 py-4 text-xs text-slate-500">
                      {reservation.booking_reference ||
                        reservation.id.slice(0, 8)}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${getStatusBadgeClasses(
                          reservation.status
                        )}`}
                      >
                        {reservation.status ?? "unknown"}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                        Review Required
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <button
                        onClick={() =>
                          router.push(`/reservations/${reservation.id}`)
                        }
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        View Reservation
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && reservations.length > 0 && (
        <p className="mt-3 text-sm text-slate-500">
          {total} reservation{total !== 1 ? "s" : ""} awaiting review.
        </p>
      )}

      <PaginationControls
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </main>
  );
}
