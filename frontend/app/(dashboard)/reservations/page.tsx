"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { PaginationControls } from "@/components/shared/pagination-controls";

interface PropertySummary {
  id: string;
  title: string;
}

interface GuestSummary {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
}

interface Reservation {
  id: string;
  organization_id?: string;

  property_id: string;
  guest_id: string;

  property: PropertySummary | null;
  guest: GuestSummary | null;

  booking_reference: string | null;
  source: string;
  status: string;

  check_in: string;
  check_out: string;

  adults: number;
  children: number;
  infants: number;
  pets: number;

  nights: number | null;

  total_amount: number | null;
  cleaning_fee: number | null;
  taxes: number | null;

  currency: string | null;

  special_requests: string | null;

  created_at?: string;
  updated_at?: string;
}

interface Property {
  id: string;
  title: string;
  property_type?: string;
  city?: string | null;
}

interface Guest {
  id: string;
  first_name: string;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  vip?: boolean;
}

type ModalMode = "view" | "edit" | null;

interface ReservationForm {
  property_id: string;
  guest_id: string;
  booking_reference: string;
  source: string;
  status: string;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  infants: number;
  pets: number;
  total_amount: string;
  cleaning_fee: string;
  taxes: string;
  currency: string;
  special_requests: string;
}

const initialForm: ReservationForm = {
  property_id: "",
  guest_id: "",
  booking_reference: "",
  source: "direct",
  status: "confirmed",
  check_in: "",
  check_out: "",
  adults: 1,
  children: 0,
  infants: 0,
  pets: 0,
  total_amount: "",
  cleaning_fee: "",
  taxes: "",
  currency: "USD",
  special_requests: "",
};

function calculateNights(
  checkIn: string,
  checkOut: string
): number {
  if (!checkIn || !checkOut) return 0;

  const start = new Date(`${checkIn}T00:00:00`);
  const end = new Date(`${checkOut}T00:00:00`);

  const difference =
    end.getTime() - start.getTime();

  if (difference <= 0) return 0;

  return Math.round(
    difference / (1000 * 60 * 60 * 24)
  );
}

function formatCurrency(
  amount: number | null,
  currency: string | null
) {
  if (amount === null || amount === undefined) {
    return "-";
  }

  return `${currency ?? "USD"} ${Number(amount).toLocaleString(
    undefined,
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
}

function getStatusClasses(status: string) {
  switch (status.toLowerCase()) {
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

function isImportedReservation(
  bookingReference: string | null
) {
  return !!bookingReference && bookingReference.startsWith("ical:");
}

function getGuestName(
  guest: GuestSummary | null
) {
  if (!guest) return "Unknown guest";

  return `${guest.first_name} ${
    guest.last_name ?? ""
  }`.trim();
}

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<
    Reservation[]
  >([]);

  /*
   * These are still needed for the
   * Create Reservation dropdowns.
   */
  const [properties, setProperties] = useState<Property[]>(
    []
  );

  const [guests, setGuests] = useState<Guest[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [conflictWarning, setConflictWarning] = useState("");

  const [showCreateModal, setShowCreateModal] =
    useState(false);

  const [selectedReservation, setSelectedReservation] =
    useState<Reservation | null>(null);

  const [modalMode, setModalMode] =
    useState<ModalMode>(null);

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [propertyFilter, setPropertyFilter] = useState("all");
  const [startFilter, setStartFilter] = useState("");
  const [endFilter, setEndFilter] = useState("");

  const [form, setForm] =
    useState<ReservationForm>(initialForm);

  /*
   * Load reservations + properties + guests.
   *
   * Reservations now already contain:
   *
   * reservation.property
   * reservation.guest
   *
   * Properties and guests are still loaded
   * because the Create Reservation form needs
   * them for dropdowns.
   */
  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [
        reservationResponse,
        propertyResponse,
        guestResponse,
      ] = await Promise.all([
        apiFetch("/api/reservations"),
        apiFetch("/api/properties?limit=100"),
        apiFetch("/api/guests?limit=100"),
      ]);

      setReservations(
        reservationResponse.data ?? []
      );

      setProperties(
        propertyResponse.data ?? []
      );

      setGuests(
        guestResponse.data ?? []
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load reservations"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  /*
   * Filter reservations.
   *
   * IMPORTANT:
   * We now use reservation.property and
   * reservation.guest directly.
   */
  const filteredReservations = useMemo(() => {
    const query = search.trim().toLowerCase();

    return reservations.filter((reservation) => {
      const propertyName =
        reservation.property?.title ?? "";

      const guestName =
        getGuestName(reservation.guest);

      const guestEmail =
        reservation.guest?.email ?? "";

      const matchesSearch =
        !query ||
        reservation.booking_reference
          ?.toLowerCase()
          .includes(query) ||
        propertyName
          .toLowerCase()
          .includes(query) ||
        guestName
          .toLowerCase()
          .includes(query) ||
        guestEmail
          .toLowerCase()
          .includes(query) ||
        reservation.source
          ?.toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        reservation.status === statusFilter;

      const matchesProperty =
        propertyFilter === "all" ||
        reservation.property_id === propertyFilter;

      const matchesStart =
        !startFilter || reservation.check_in >= startFilter;

      const matchesEnd =
        !endFilter || reservation.check_out <= endFilter;

      return Boolean(
        matchesSearch &&
          matchesStatus &&
          matchesProperty &&
          matchesStart &&
          matchesEnd
      );
    });
  }, [
    reservations,
    search,
    statusFilter,
    propertyFilter,
    startFilter,
    endFilter,
  ]);

  function updateForm(
    field: keyof ReservationForm,
    value: string | number
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetForm() {
    setForm(initialForm);
  }

  function openCreateModal() {
    resetForm();
    setError("");
    setShowCreateModal(true);
  }

  function closeCreateModal() {
    if (saving) return;

    setShowCreateModal(false);
    resetForm();
  }

  /*
   * Create reservation
   */
  async function createReservation(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const nights = calculateNights(
      form.check_in,
      form.check_out
    );

    if (nights <= 0) {
      setError(
        "Check-out date must be after check-in date."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await apiFetch(
        "/api/reservations",
        {
          method: "POST",

          body: JSON.stringify({
            property_id: form.property_id,
            guest_id: form.guest_id,

            booking_reference:
              form.booking_reference || null,

            source: form.source,

            status: form.status,

            check_in: form.check_in,
            check_out: form.check_out,

            adults: Number(form.adults),
            children: Number(form.children),
            infants: Number(form.infants),
            pets: Number(form.pets),

            nights,

            total_amount:
              form.total_amount === ""
                ? null
                : Number(form.total_amount),

            cleaning_fee:
              form.cleaning_fee === ""
                ? 0
                : Number(form.cleaning_fee),

            taxes:
              form.taxes === ""
                ? 0
                : Number(form.taxes),

            currency: form.currency,

            special_requests:
              form.special_requests || null,
          }),
        }
      );

      /*
       * The POST response may contain the
       * reservation but depending on the backend
       * it may not contain the nested property/guest.
       *
       * Reloading ensures the new reservation
       * gets the same relational structure as
       * the GET endpoint.
       */
      await loadData();

      setConflictWarning(
        response.conflictCount > 0
          ? `Note: this reservation's dates overlap with ${response.conflictCount} other reservation(s) for this property.`
          : ""
      );

      closeCreateModal();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create reservation"
      );
    } finally {
      setSaving(false);
    }
  }

  /*
   * Open view modal
   */
  function openViewReservation(
    reservation: Reservation
  ) {
    setSelectedReservation(reservation);
    setModalMode("view");
    setError("");
  }

  /*
   * Open edit modal
   */
  function openEditReservation(
    reservation: Reservation
  ) {
    setSelectedReservation({
      ...reservation,
      nights: calculateNights(
        reservation.check_in,
        reservation.check_out
      ),
    });

    setModalMode("edit");
    setError("");
  }

  /*
   * Close view/edit modal
   */
  function closeReservationModal() {
    if (saving) return;

    setSelectedReservation(null);
    setModalMode(null);
  }

  /*
   * Update selected reservation
   */
  async function updateReservation() {
    if (!selectedReservation) return;

    const nights = calculateNights(
      selectedReservation.check_in,
      selectedReservation.check_out
    );

    if (nights <= 0) {
      setError(
        "Check-out date must be after check-in date."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      await apiFetch(
        `/api/reservations/${selectedReservation.id}`,
        {
          method: "PATCH",

          body: JSON.stringify({
            check_in:
              selectedReservation.check_in,

            check_out:
              selectedReservation.check_out,

            adults:
              Number(selectedReservation.adults),

            children:
              Number(selectedReservation.children),

            infants:
              Number(selectedReservation.infants),

            pets:
              Number(selectedReservation.pets),

            total_amount:
              selectedReservation.total_amount,

            cleaning_fee:
              selectedReservation.cleaning_fee ?? 0,

            taxes:
              selectedReservation.taxes ?? 0,

            status:
              selectedReservation.status,

            nights,
          }),
        }
      );

      /*
       * Reload to get the complete relational
       * property + guest objects again.
       */
      await loadData();

      setSelectedReservation(null);
      setModalMode(null);
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

  /*
   * Cancel reservation
   */
  async function cancelReservation(
    reservation: Reservation
  ) {
    const confirmed = window.confirm(
      `Cancel reservation ${
        reservation.booking_reference ??
        reservation.id.slice(0, 8)
      }?`
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      setError("");

      await apiFetch(
        `/api/reservations/${reservation.id}`,
        {
          method: "PATCH",

          body: JSON.stringify({
            status: "cancelled",
          }),
        }
      );

      /*
       * Reload so the relational property/guest
       * data remains consistent.
       */
      await loadData();

      if (
        selectedReservation?.id === reservation.id
      ) {
        setSelectedReservation((current) =>
          current
            ? {
                ...current,
                status: "cancelled",
              }
            : current
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to cancel reservation"
      );
    } finally {
      setSaving(false);
    }
  }

  /*
   * Edit selected reservation field
   */
  function updateSelectedReservation(
    field: keyof Reservation,
    value: string | number | null
  ) {
    setSelectedReservation((current) => {
      if (!current) return current;

      return {
        ...current,
        [field]: value,
      };
    });
  }

  const createNights = calculateNights(
    form.check_in,
    form.check_out
  );

  const selectedNights = selectedReservation
    ? calculateNights(
        selectedReservation.check_in,
        selectedReservation.check_out
      )
    : 0;

  return (
    <div className="min-h-full">

      {/* Header */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Reservations
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage bookings, guests, stays, and
            reservation status.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
        >
          <span className="mr-2 text-lg leading-none">
            +
          </span>

          New Reservation
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-5 flex items-start justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>

          <button
            onClick={() => setError("")}
            className="font-medium text-red-700 hover:text-red-900"
          >
            ✕
          </button>
        </div>
      )}

      {conflictWarning && (
        <div className="mt-5 flex items-start justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>{conflictWarning}</span>

          <button
            onClick={() => setConflictWarning("")}
            className="font-medium text-amber-800 hover:text-amber-950"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="mt-6 flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm md:flex-row">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            🔍
          </span>

          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search booking, guest, property..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value)
          }
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400"
        >
          <option value="all">
            All statuses
          </option>

          <option value="confirmed">
            Confirmed
          </option>

          <option value="pending">
            Pending
          </option>

          <option value="completed">
            Completed
          </option>

          <option value="cancelled">
            Cancelled
          </option>
        </select>

        <select
          value={propertyFilter}
          onChange={(event) => setPropertyFilter(event.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400"
        >
          <option value="all">All properties</option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.title}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={startFilter}
          onChange={(event) => setStartFilter(event.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400"
        />

        <span className="self-center text-sm text-slate-400">to</span>

        <input
          type="date"
          value={endFilter}
          onChange={(event) => setEndFilter(event.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400"
        />

        <button
          onClick={loadData}
          disabled={loading}
          className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Total Reservations
          </p>

          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {reservations.length}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Confirmed
          </p>

          <p className="mt-2 text-2xl font-semibold text-emerald-600">
            {
              reservations.filter(
                (item) =>
                  item.status === "confirmed"
              ).length
            }
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Pending
          </p>

          <p className="mt-2 text-2xl font-semibold text-amber-600">
            {
              reservations.filter(
                (item) =>
                  item.status === "pending"
              ).length
            }
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Cancelled
          </p>

          <p className="mt-2 text-2xl font-semibold text-red-600">
            {
              reservations.filter(
                (item) =>
                  item.status === "cancelled"
              ).length
            }
          </p>
        </div>

      </div>

      {/* Table */}
      <div className="mt-6 overflow-hidden rounded-xl border bg-white shadow-sm">

        {loading ? (
          <div className="p-12 text-center">
            <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />

            <p className="mt-4 text-sm text-slate-500">
              Loading reservations...
            </p>
          </div>
        ) : filteredReservations.length === 0 ? (
          <div className="p-12 text-center">

            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              📅
            </div>

            <h3 className="mt-4 font-medium text-slate-900">
              No reservations found
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              {search ||
              statusFilter !== "all"
                ? "Try changing your search or filters."
                : "Create your first reservation to get started."}
            </p>

            {!search &&
              statusFilter === "all" && (
                <button
                  onClick={openCreateModal}
                  className="mt-5 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Create Reservation
                </button>
              )}
          </div>
        ) : (
          <div className="overflow-x-auto">

            <table className="w-full min-w-[1050px] text-left text-sm">

              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="px-5 py-4 font-medium text-slate-600">
                    Booking
                  </th>

                  <th className="px-5 py-4 font-medium text-slate-600">
                    Guest
                  </th>

                  <th className="px-5 py-4 font-medium text-slate-600">
                    Property
                  </th>

                  <th className="px-5 py-4 font-medium text-slate-600">
                    Stay
                  </th>

                  <th className="px-5 py-4 font-medium text-slate-600">
                    Guests
                  </th>

                  <th className="px-5 py-4 font-medium text-slate-600">
                    Amount
                  </th>

                  <th className="px-5 py-4 font-medium text-slate-600">
                    Status
                  </th>

                  <th className="px-5 py-4 text-right font-medium text-slate-600">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y">

                {filteredReservations.map(
                  (reservation) => {

                    const guestName =
                      getGuestName(
                        reservation.guest
                      );

                    return (
                      <tr
                        key={reservation.id}
                        className="transition hover:bg-slate-50"
                      >

                        {/* Booking */}
                        <td className="px-5 py-4">
                          <button
                            onClick={() =>
                              openViewReservation(
                                reservation
                              )
                            }
                            className="font-medium text-slate-900 hover:underline"
                          >
                            {isImportedReservation(
                              reservation.booking_reference
                            )
                              ? reservation.id.slice(0, 8)
                              : reservation.booking_reference ||
                                reservation.id.slice(
                                  0,
                                  8
                                )}
                          </button>

                          {isImportedReservation(
                            reservation.booking_reference
                          ) && (
                            <span className="ml-2 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-700">
                              Imported
                            </span>
                          )}

                          <p className="mt-1 text-xs capitalize text-slate-500">
                            {reservation.source}
                          </p>
                        </td>

                        {/* Guest */}
                        <td className="px-5 py-4">

                          <p className="font-medium text-slate-800">
                            {guestName}
                          </p>

                          {reservation.guest
                            ?.email && (
                            <p className="mt-1 max-w-[200px] truncate text-xs text-slate-500">
                              {
                                reservation
                                  .guest
                                  .email
                              }
                            </p>
                          )}

                        </td>

                        {/* Property */}
                        <td className="px-5 py-4">

                          <p className="font-medium text-slate-800">
                            {reservation.property
                              ?.title ??
                              "Unknown property"}
                          </p>

                        </td>

                        {/* Stay */}
                        <td className="px-5 py-4">

                          <p className="text-slate-700">
                            {reservation.check_in}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            →{" "}
                            {
                              reservation.check_out
                            }
                          </p>

                          <p className="mt-1 text-xs font-medium text-slate-600">
                            {reservation.nights ??
                              (calculateNights(
                                reservation.check_in,
                                reservation.check_out
                              ) || "-")}{" "}
                            nights
                          </p>

                        </td>

                        {/* Guests */}
                        <td className="px-5 py-4">

                          <p className="font-medium text-slate-800">
                            {reservation.adults +
                              reservation.children +
                              reservation.infants}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {reservation.adults} adults
                          </p>

                        </td>

                        {/* Amount */}
                        <td className="px-5 py-4">

                          <p className="font-medium text-slate-900">
                            {formatCurrency(
                              reservation.total_amount,
                              reservation.currency
                            )}
                          </p>

                          {reservation.taxes &&
                            reservation.taxes >
                              0 ? (
                            <p className="mt-1 text-xs text-slate-500">
                              + taxes
                            </p>
                          ) : null}

                        </td>

                        {/* Status */}
                        <td className="px-5 py-4">

                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${getStatusClasses(
                              reservation.status
                            )}`}
                          >
                            {
                              reservation.status
                            }
                          </span>

                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4">

                          <div className="flex justify-end gap-2">

                            <button
                              onClick={() =>
                                openViewReservation(
                                  reservation
                                )
                              }
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              View
                            </button>

                            <button
                              onClick={() =>
                                openEditReservation(
                                  reservation
                                )
                              }
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Edit
                            </button>

                            {reservation.status !==
                              "cancelled" && (
                              <button
                                onClick={() =>
                                  cancelReservation(
                                    reservation
                                  )
                                }
                                disabled={saving}
                                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            )}

                          </div>

                        </td>

                      </tr>
                    );
                  }
                )}

              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Reservation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">

          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">

            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-5">

              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  New Reservation
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Create a new guest reservation.
                </p>
              </div>

              <button
                onClick={closeCreateModal}
                className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>

            </div>

            <form
              onSubmit={createReservation}
              className="space-y-6 p-6"
            >

              {/* Property + Guest */}
              <div className="grid gap-5 md:grid-cols-2">

                <div>
                  <label htmlFor="create-property_id" className="text-sm font-medium text-slate-700">
                    Property *
                  </label>

                  <select
                    id="create-property_id"
                    required
                    value={form.property_id}
                    onChange={(event) =>
                      updateForm(
                        "property_id",
                        event.target.value
                      )
                    }
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                  >
                    <option value="">
                      Select property
                    </option>

                    {properties.map(
                      (property) => (
                        <option
                          key={property.id}
                          value={property.id}
                        >
                          {property.title}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label htmlFor="create-guest_id" className="text-sm font-medium text-slate-700">
                    Guest *
                  </label>

                  <select
                    id="create-guest_id"
                    required
                    value={form.guest_id}
                    onChange={(event) =>
                      updateForm(
                        "guest_id",
                        event.target.value
                      )
                    }
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                  >
                    <option value="">
                      Select guest
                    </option>

                    {guests.map((guest) => (
                      <option
                        key={guest.id}
                        value={guest.id}
                      >
                        {guest.first_name}{" "}
                        {guest.last_name ?? ""}
                        {guest.vip
                          ? " ★ VIP"
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>

              </div>

              {/* Booking */}
              <div className="grid gap-5 md:grid-cols-3">

                <div>
                  <label htmlFor="create-booking_reference" className="text-sm font-medium text-slate-700">
                    Booking Reference
                  </label>

                  <input
                    id="create-booking_reference"
                    value={form.booking_reference}
                    onChange={(event) =>
                      updateForm(
                        "booking_reference",
                        event.target.value
                      )
                    }
                    placeholder="RES-1001"
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                  />
                </div>

                <div>
                  <label htmlFor="create-source" className="text-sm font-medium text-slate-700">
                    Source
                  </label>

                  <select
                    id="create-source"
                    value={form.source}
                    onChange={(event) =>
                      updateForm(
                        "source",
                        event.target.value
                      )
                    }
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
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
                      VRBO
                    </option>

                    <option value="other">
                      Other
                    </option>
                  </select>
                </div>

                <div>
                  <label htmlFor="create-status" className="text-sm font-medium text-slate-700">
                    Status
                  </label>

                  <select
                    id="create-status"
                    value={form.status}
                    onChange={(event) =>
                      updateForm(
                        "status",
                        event.target.value
                      )
                    }
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                  >
                    <option value="confirmed">
                      Confirmed
                    </option>

                    <option value="pending">
                      Pending
                    </option>
                  </select>
                </div>

              </div>

              {/* Dates */}
              <div>

                <h3 className="text-sm font-semibold text-slate-900">
                  Stay Details
                </h3>

                <div className="mt-4 grid gap-5 md:grid-cols-3">

                  <div>
                    <label htmlFor="create-check_in" className="text-sm font-medium text-slate-700">
                      Check-in *
                    </label>

                    <input
                      id="create-check_in"
                      required
                      type="date"
                      value={form.check_in}
                      onChange={(event) =>
                        updateForm(
                          "check_in",
                          event.target.value
                        )
                      }
                      className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="create-check_out" className="text-sm font-medium text-slate-700">
                      Check-out *
                    </label>

                    <input
                      id="create-check_out"
                      required
                      type="date"
                      value={form.check_out}
                      min={
                        form.check_in ||
                        undefined
                      }
                      onChange={(event) =>
                        updateForm(
                          "check_out",
                          event.target.value
                        )
                      }
                      className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                    />
                  </div>

                  <div className="flex items-end">

                    <div className="w-full rounded-lg bg-slate-50 px-4 py-3">

                      <p className="text-xs text-slate-500">
                        Nights
                      </p>

                      <p className="mt-1 font-semibold text-slate-900">
                        {createNights || "-"}
                      </p>

                    </div>

                  </div>

                </div>
              </div>

              {/* Guest Count */}
              <div>

                <h3 className="text-sm font-semibold text-slate-900">
                  Guests
                </h3>

                <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">

                  {[
                    ["adults", "Adults", 1],
                    [
                      "children",
                      "Children",
                      0,
                    ],
                    [
                      "infants",
                      "Infants",
                      0,
                    ],
                    ["pets", "Pets", 0],
                  ].map(
                    ([field, label, min]) => (
                      <div key={field}>

                        <label htmlFor={`create-${field}`} className="text-sm font-medium text-slate-700">
                          {label}
                        </label>

                        <input
                          id={`create-${field}`}
                          type="number"
                          min={Number(min)}
                          value={
                            form[
                              field as keyof ReservationForm
                            ] as number
                          }
                          onChange={(event) =>
                            updateForm(
                              field as keyof ReservationForm,
                              Number(
                                event.target.value
                              )
                            )
                          }
                          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                        />

                      </div>
                    )
                  )}

                </div>
              </div>

              {/* Financial */}
              <div>

                <h3 className="text-sm font-semibold text-slate-900">
                  Financial
                </h3>

                <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">

                  <div>
                    <label htmlFor="create-total_amount" className="text-sm font-medium text-slate-700">
                      Total Amount
                    </label>

                    <input
                      id="create-total_amount"
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.total_amount}
                      onChange={(event) =>
                        updateForm(
                          "total_amount",
                          event.target.value
                        )
                      }
                      placeholder="300"
                      className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="create-cleaning_fee" className="text-sm font-medium text-slate-700">
                      Cleaning Fee
                    </label>

                    <input
                      id="create-cleaning_fee"
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.cleaning_fee}
                      onChange={(event) =>
                        updateForm(
                          "cleaning_fee",
                          event.target.value
                        )
                      }
                      className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="create-taxes" className="text-sm font-medium text-slate-700">
                      Taxes
                    </label>

                    <input
                      id="create-taxes"
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.taxes}
                      onChange={(event) =>
                        updateForm(
                          "taxes",
                          event.target.value
                        )
                      }
                      className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="create-currency" className="text-sm font-medium text-slate-700">
                      Currency
                    </label>

                    <select
                      id="create-currency"
                      value={form.currency}
                      onChange={(event) =>
                        updateForm(
                          "currency",
                          event.target.value
                        )
                      }
                      className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                    >
                      <option value="USD">
                        USD
                      </option>

                      <option value="PKR">
                        PKR
                      </option>

                      <option value="EUR">
                        EUR
                      </option>

                      <option value="GBP">
                        GBP
                      </option>
                    </select>
                  </div>

                </div>
              </div>

              {/* Requests */}
              <div>

                <label htmlFor="create-special_requests" className="text-sm font-medium text-slate-700">
                  Special Requests
                </label>

                <textarea
                  id="create-special_requests"
                  rows={4}
                  value={form.special_requests}
                  onChange={(event) =>
                    updateForm(
                      "special_requests",
                      event.target.value
                    )
                  }
                  placeholder="Late check-in, extra bed, airport pickup..."
                  className="mt-2 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                />

              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 border-t pt-5">

                <button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={saving}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    saving ||
                    !form.property_id ||
                    !form.guest_id
                  }
                  className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Creating..."
                    : "Create Reservation"}
                </button>

              </div>

            </form>
          </div>
        </div>
      )}

      {/* View / Edit Modal */}
      {selectedReservation &&
        modalMode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">

            <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">

              {/* Header */}
              <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-5">

                <div>

                  <h2 className="text-lg font-semibold text-slate-900">
                    {modalMode === "view"
                      ? "Reservation Details"
                      : "Edit Reservation"}
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {selectedReservation.booking_reference ||
                      selectedReservation.id}
                  </p>

                </div>

                <button
                  onClick={
                    closeReservationModal
                  }
                  className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100"
                >
                  ✕
                </button>

              </div>

              <div className="space-y-6 p-6">

                {/* Summary */}
                <div className="grid gap-4 sm:grid-cols-2">

                  <div className="rounded-lg bg-slate-50 p-4">

                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Property
                    </p>

                    <p className="mt-1 font-medium text-slate-900">
                      {selectedReservation.property
                        ?.title ??
                        "Unknown property"}
                    </p>

                  </div>

                  <div className="rounded-lg bg-slate-50 p-4">

                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Guest
                    </p>

                    <p className="mt-1 font-medium text-slate-900">
                      {getGuestName(
                        selectedReservation.guest
                      )}
                    </p>

                    {selectedReservation.guest
                      ?.email && (
                      <p className="mt-1 text-xs text-slate-500">
                        {
                          selectedReservation
                            .guest.email
                        }
                      </p>
                    )}

                  </div>

                </div>

                {/* View */}
                {modalMode === "view" && (
                  <>
                    <div className="grid gap-5 sm:grid-cols-2">

                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Booking Reference
                        </p>

                        <p className="mt-1 text-slate-900">
                          {selectedReservation.booking_reference ??
                            "-"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Source
                        </p>

                        <p className="mt-1 capitalize text-slate-900">
                          {selectedReservation.source}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Check-in
                        </p>

                        <p className="mt-1 text-slate-900">
                          {selectedReservation.check_in}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Check-out
                        </p>

                        <p className="mt-1 text-slate-900">
                          {selectedReservation.check_out}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Nights
                        </p>

                        <p className="mt-1 text-slate-900">
                          {selectedNights}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Status
                        </p>

                        <span
                          className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${getStatusClasses(
                            selectedReservation.status
                          )}`}
                        >
                          {
                            selectedReservation.status
                          }
                        </span>
                      </div>

                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Guests
                        </p>

                        <p className="mt-1 text-slate-900">
                          {selectedReservation.adults +
                            selectedReservation.children +
                            selectedReservation.infants}{" "}
                          total
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {
                            selectedReservation.adults
                          }{" "}
                          adults ·{" "}
                          {
                            selectedReservation.children
                          }{" "}
                          children ·{" "}
                          {
                            selectedReservation.infants
                          }{" "}
                          infants ·{" "}
                          {
                            selectedReservation.pets
                          }{" "}
                          pets
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Total Amount
                        </p>

                        <p className="mt-1 text-lg font-semibold text-slate-900">
                          {formatCurrency(
                            selectedReservation.total_amount,
                            selectedReservation.currency
                          )}
                        </p>
                      </div>

                    </div>

                    {(selectedReservation.special_requests ||
                      selectedReservation.cleaning_fee ||
                      selectedReservation.taxes) && (
                      <div className="border-t pt-5">

                        <h3 className="text-sm font-semibold text-slate-900">
                          Additional Details
                        </h3>

                        {selectedReservation.special_requests && (
                          <div className="mt-4 rounded-lg bg-slate-50 p-4">

                            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                              Special Requests
                            </p>

                            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                              {
                                selectedReservation.special_requests
                              }
                            </p>

                          </div>
                        )}

                        <div className="mt-4 grid gap-4 sm:grid-cols-2">

                          <div>
                            <p className="text-xs text-slate-500">
                              Cleaning Fee
                            </p>

                            <p className="mt-1 font-medium text-slate-900">
                              {formatCurrency(
                                selectedReservation.cleaning_fee,
                                selectedReservation.currency
                              )}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-slate-500">
                              Taxes
                            </p>

                            <p className="mt-1 font-medium text-slate-900">
                              {formatCurrency(
                                selectedReservation.taxes,
                                selectedReservation.currency
                              )}
                            </p>
                          </div>

                        </div>
                      </div>
                    )}

                    <div className="flex justify-end border-t pt-5">

                      <button
                        onClick={() =>
                          openEditReservation(
                            selectedReservation
                          )
                        }
                        className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
                      >
                        Edit Reservation
                      </button>

                    </div>
                  </>
                )}

                {/* Edit */}
                {modalMode === "edit" && (
                  <>
                    <div className="grid gap-5 sm:grid-cols-2">

                      <div>
                        <label htmlFor="edit-check_in" className="text-sm font-medium text-slate-700">
                          Check-in
                        </label>

                        <input
                          id="edit-check_in"
                          type="date"
                          value={
                            selectedReservation.check_in
                          }
                          onChange={(event) =>
                            updateSelectedReservation(
                              "check_in",
                              event.target.value
                            )
                          }
                          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                        />
                      </div>

                      <div>
                        <label htmlFor="edit-check_out" className="text-sm font-medium text-slate-700">
                          Check-out
                        </label>

                        <input
                          id="edit-check_out"
                          type="date"
                          min={
                            selectedReservation.check_in
                          }
                          value={
                            selectedReservation.check_out
                          }
                          onChange={(event) =>
                            updateSelectedReservation(
                              "check_out",
                              event.target.value
                            )
                          }
                          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                        />
                      </div>

                      <div>
                        <label htmlFor="edit-adults" className="text-sm font-medium text-slate-700">
                          Adults
                        </label>

                        <input
                          id="edit-adults"
                          type="number"
                          min={1}
                          value={
                            selectedReservation.adults
                          }
                          onChange={(event) =>
                            updateSelectedReservation(
                              "adults",
                              Number(
                                event.target.value
                              )
                            )
                          }
                          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                        />
                      </div>

                      <div>
                        <label htmlFor="edit-children" className="text-sm font-medium text-slate-700">
                          Children
                        </label>

                        <input
                          id="edit-children"
                          type="number"
                          min={0}
                          value={
                            selectedReservation.children
                          }
                          onChange={(event) =>
                            updateSelectedReservation(
                              "children",
                              Number(
                                event.target.value
                              )
                            )
                          }
                          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                        />
                      </div>

                      <div>
                        <label htmlFor="edit-infants" className="text-sm font-medium text-slate-700">
                          Infants
                        </label>

                        <input
                          id="edit-infants"
                          type="number"
                          min={0}
                          value={
                            selectedReservation.infants
                          }
                          onChange={(event) =>
                            updateSelectedReservation(
                              "infants",
                              Number(
                                event.target.value
                              )
                            )
                          }
                          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                        />
                      </div>

                      <div>
                        <label htmlFor="edit-pets" className="text-sm font-medium text-slate-700">
                          Pets
                        </label>

                        <input
                          id="edit-pets"
                          type="number"
                          min={0}
                          value={
                            selectedReservation.pets
                          }
                          onChange={(event) =>
                            updateSelectedReservation(
                              "pets",
                              Number(
                                event.target.value
                              )
                            )
                          }
                          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                        />
                      </div>

                      <div>
                        <label htmlFor="edit-total_amount" className="text-sm font-medium text-slate-700">
                          Total Amount
                        </label>

                        <input
                          id="edit-total_amount"
                          type="number"
                          min={0}
                          step="0.01"
                          value={
                            selectedReservation.total_amount ??
                            ""
                          }
                          onChange={(event) =>
                            updateSelectedReservation(
                              "total_amount",
                              event.target.value ===
                                ""
                                ? null
                                : Number(
                                    event.target.value
                                  )
                            )
                          }
                          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                        />
                      </div>

                      <div>
                        <label htmlFor="edit-status" className="text-sm font-medium text-slate-700">
                          Status
                        </label>

                        <select
                          id="edit-status"
                          value={
                            selectedReservation.status
                          }
                          onChange={(event) =>
                            updateSelectedReservation(
                              "status",
                              event.target.value
                            )
                          }
                          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                        >
                          <option value="confirmed">
                            Confirmed
                          </option>

                          <option value="pending">
                            Pending
                          </option>

                          <option value="completed">
                            Completed
                          </option>

                          <option value="cancelled">
                            Cancelled
                          </option>
                        </select>
                      </div>

                    </div>

                    {/* Nights preview */}
                    <div className="rounded-lg bg-slate-50 p-4">

                      <p className="text-xs text-slate-500">
                        Updated stay
                      </p>

                      <p className="mt-1 font-semibold text-slate-900">
                        {selectedNights} nights
                      </p>

                    </div>

                    {/* Edit buttons */}
                    <div className="flex justify-end gap-3 border-t pt-5">

                      <button
                        type="button"
                        onClick={
                          closeReservationModal
                        }
                        disabled={saving}
                        className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        onClick={updateReservation}
                        disabled={saving}
                        className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        {saving
                          ? "Saving..."
                          : "Save Changes"}
                      </button>

                    </div>
                  </>
                )}

              </div>
            </div>
          </div>
        )}

    </div>
  );
}