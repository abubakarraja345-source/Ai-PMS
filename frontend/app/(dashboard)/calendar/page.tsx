"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EventInput } from "@fullcalendar/core";
import { apiFetch } from "@/lib/api";
import { formatMoney as formatMoneyShared } from "@/lib/currency";
import FullCalendarView, {
  CalendarViewType,
  FullCalendarViewHandle,
} from "@/components/calendar/full-calendar-view";

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

interface CalendarReservation {
  id: string;
  property_id: string;
  guest_id: string;
  property?: PropertySummary | null;
  guest?: GuestSummary | null;
  booking_reference: string | null;
  source: string;
  status: string | null;
  check_in: string;
  check_out: string;
  nights: number | null;
  total_amount: number | null;
  currency: string | null;
  needs_review: boolean;
}

function toDateOnlyString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getGuestName(guest: GuestSummary | null | undefined) {
  if (!guest) return "Unknown guest";
  return `${guest.first_name} ${guest.last_name ?? ""}`.trim();
}

function isImportedReservation(bookingReference: string | null) {
  return !!bookingReference && bookingReference.startsWith("ical:");
}

/**
 * Client-side overlap check across the currently loaded reservations
 * (already scoped to the visible date range / property filter) —
 * flags any reservation whose dates overlap another reservation for
 * the same property, so the calendar can visually surface conflicts
 * without changing any create/update behavior.
 */
function findConflictingIds(
  reservations: CalendarReservation[]
): Set<string> {
  const conflicting = new Set<string>();

  for (let i = 0; i < reservations.length; i++) {
    for (let j = i + 1; j < reservations.length; j++) {
      const a = reservations[i];
      const b = reservations[j];

      if (a.property_id !== b.property_id) continue;

      const overlaps = a.check_in < b.check_out && a.check_out > b.check_in;

      if (overlaps) {
        conflicting.add(a.id);
        conflicting.add(b.id);
      }
    }
  }

  return conflicting;
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
      return "bg-muted text-foreground/80 border-border";
  }
}

/**
 * Tailwind v4 moved the "important" modifier from a leading `!`
 * (v3: `!bg-emerald-100`) to a trailing `!` (v4: `bg-emerald-100!`) —
 * see frontend/AGENTS.md's warning that this project's tooling has
 * breaking changes from what training data assumes. The leading-`!`
 * form isn't recognized syntax in v4 at all, so those classes were
 * silently generating no CSS — FullCalendar's own bare default
 * styling (very low contrast) was all that ever rendered.
 */
const EVENT_BASE_CLASSES = ["rounded-md!", "border-l-4!", "shadow-none!"];

/**
 * FullCalendar sets its own default event text color (--fc-event-
 * text-color, white) directly on the elements it renders — that wins
 * over plain CSS inheritance from our Tailwind text-color classes on
 * the outer wrapper regardless of !important, since it's applied
 * closer to (or directly on) the title text itself. full-calendar-
 * view.tsx's eventContent reads this hex value and forces it via
 * inline style + "important" priority on the exact elements it
 * creates, which is the only thing guaranteed to win.
 */
function getEventTextColor(status: string | null): string {
  switch (status) {
    case "confirmed":
      return "#065f46"; // emerald-800
    case "pending":
      return "#92400e"; // amber-800
    case "completed":
      return "#1e40af"; // blue-800
    case "cancelled":
      return "#991b1b"; // red-800
    default:
      return "#1e293b"; // slate-800
  }
}

function getEventClassNames(status: string | null): string[] {
  switch (status) {
    case "confirmed":
      return [
        ...EVENT_BASE_CLASSES,
        "bg-emerald-50!",
        "border-emerald-500!",
        "text-emerald-800!",
      ];
    case "pending":
      return [
        ...EVENT_BASE_CLASSES,
        "bg-amber-50!",
        "border-amber-500!",
        "text-amber-800!",
      ];
    case "completed":
      return [
        ...EVENT_BASE_CLASSES,
        "bg-blue-50!",
        "border-blue-500!",
        "text-blue-800!",
      ];
    case "cancelled":
      return [
        ...EVENT_BASE_CLASSES,
        "bg-red-50!",
        "border-red-500!",
        "text-red-800!",
      ];
    default:
      return [
        ...EVENT_BASE_CLASSES,
        "bg-muted!",
        "border-primary!",
        "text-foreground/90!",
      ];
  }
}

function formatMoney(
  amount: number | null,
  currency: string | null
) {
  return formatMoneyShared(amount, currency);
}

export default function CalendarPage() {
  const router = useRouter();
  const calendarRef = useRef<FullCalendarViewHandle>(null);

  const [view, setView] = useState<CalendarViewType>(
    "dayGridMonth"
  );
  const [rangeTitle, setRangeTitle] = useState("");
  const [visibleRange, setVisibleRange] = useState<{
    start: string;
    end: string;
  } | null>(null);

  const [properties, setProperties] = useState<
    PropertyOption[]
  >([]);
  const [propertyId, setPropertyId] = useState("all");

  const [reservations, setReservations] = useState<
    CalendarReservation[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedReservation, setSelectedReservation] =
    useState<CalendarReservation | null>(null);

  useEffect(() => {
    async function loadProperties() {
      try {
        const response = await apiFetch("/api/properties?limit=100");
        setProperties(response.data ?? []);
      } catch {
        // Non-fatal — the property filter simply won't
        // populate; the calendar itself still works.
      }
    }

    loadProperties();
  }, []);

  const loadCalendarData = useCallback(
    async (
      start: string,
      end: string,
      selectedPropertyId: string
    ) => {
      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams({ start, end });

        if (selectedPropertyId !== "all") {
          params.set("property_id", selectedPropertyId);
        }

        const response = await apiFetch(
          `/api/calendar?${params.toString()}`
        );

        setReservations(response.data ?? []);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load calendar"
        );
        setReservations([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!visibleRange) return;

    loadCalendarData(
      visibleRange.start,
      visibleRange.end,
      propertyId
    );
  }, [visibleRange, propertyId, loadCalendarData]);

  function handleDatesSet(info: {
    start: Date;
    end: Date;
    title: string;
  }) {
    setRangeTitle(info.title);
    setVisibleRange({
      start: toDateOnlyString(info.start),
      end: toDateOnlyString(info.end),
    });
  }

  function handleEventClick(reservationId: string) {
    const reservation = reservations.find(
      (r) => r.id === reservationId
    );

    if (reservation) {
      setSelectedReservation(reservation);
    }
  }

  function refresh() {
    if (!visibleRange) return;
    loadCalendarData(
      visibleRange.start,
      visibleRange.end,
      propertyId
    );
  }

  const conflictingIds = findConflictingIds(reservations);

  const events: EventInput[] = reservations.map((r) => {
    const guestName = getGuestName(r.guest);
    const imported = isImportedReservation(r.booking_reference);
    const hasConflict = conflictingIds.has(r.id);

    const titleParts = [
      imported ? "⇄" : null,
      r.needs_review ? "🔖" : null,
      hasConflict ? "⚠" : null,
      r.booking_reference && !imported ? r.booking_reference : null,
      guestName,
    ].filter(Boolean);

    return {
      id: r.id,
      title: titleParts.join(" "),
      start: r.check_in,
      end: r.check_out,
      allDay: true,
      classNames: [
        ...getEventClassNames(r.status),
        ...(r.needs_review ? ["ring-2!", "ring-amber-500!"] : []),
        ...(hasConflict ? ["ring-2!", "ring-red-500!"] : []),
      ],
      extendedProps: {
        propertyTitle: r.property?.title ?? "Unknown property",
        status: r.status,
        imported,
        hasConflict,
        needsReview: r.needs_review,
        textColor: getEventTextColor(r.status),
      },
    };
  });

  return (
    <main className="min-h-screen bg-background p-4 md:p-10">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h1 className="text-3xl font-semibold text-foreground md:text-5xl">
            Calendar
          </h1>

          <p className="mt-2 text-muted-foreground md:mt-3 md:text-lg">
            Property availability and reservations at a glance.
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => calendarRef.current?.today()}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-muted"
          >
            Today
          </button>

          <div className="flex items-center gap-1">
            <button
              onClick={() => calendarRef.current?.prev()}
              aria-label="Previous"
              className="rounded-lg border border-border px-3 py-2 text-sm text-foreground/80 hover:bg-muted"
            >
              ‹
            </button>

            <button
              onClick={() => calendarRef.current?.next()}
              aria-label="Next"
              className="rounded-lg border border-border px-3 py-2 text-sm text-foreground/80 hover:bg-muted"
            >
              ›
            </button>
          </div>

          <span className="ml-1 text-sm font-medium text-foreground md:text-base">
            {rangeTitle}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-border">
            <button
              onClick={() => setView("dayGridMonth")}
              className={`px-3 py-2 text-sm font-medium transition ${
                view === "dayGridMonth"
                  ? "bg-primary text-white"
                  : "bg-card text-foreground/80 hover:bg-muted"
              }`}
            >
              Month
            </button>

            <button
              onClick={() => setView("timeGridWeek")}
              className={`border-l border-border px-3 py-2 text-sm font-medium transition ${
                view === "timeGridWeek"
                  ? "bg-primary text-white"
                  : "bg-card text-foreground/80 hover:bg-muted"
              }`}
            >
              Week
            </button>
          </div>

          <select
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground/80 outline-none focus:border-primary"
          >
            <option value="all">All properties</option>

            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.title}
              </option>
            ))}
          </select>

          <button
            onClick={refresh}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-muted"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <LegendChip
          dotClassName="bg-emerald-500"
          label="Confirmed"
        />
        <LegendChip dotClassName="bg-amber-500" label="Pending" />
        <LegendChip dotClassName="bg-blue-500" label="Completed" />
        <LegendChip
          dotClassName="bg-red-500"
          label="Cancelled (hidden)"
        />
        <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground/70">
          <span>⇄</span> Imported (iCal)
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground/70">
          <span>🔖</span> Needs review
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground/70">
          <span>⚠</span> Overlapping dates
        </span>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Calendar */}
      <div className="relative mt-4 overflow-x-auto rounded-2xl border border-border bg-card p-2 shadow-sm md:p-4">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/70">
            <span className="text-sm text-muted-foreground">
              Loading calendar...
            </span>
          </div>
        )}

        <div className="min-w-[640px]">
          <FullCalendarView
            ref={calendarRef}
            events={events}
            initialView={view}
            onDatesSet={handleDatesSet}
            onEventClick={handleEventClick}
          />
        </div>

        {!loading &&
          reservations.length === 0 &&
          !error && (
            <p className="mt-3 text-center text-sm text-muted-foreground/80">
              No reservations in this range.
            </p>
          )}
      </div>

      {/* Reservation quick-view */}
      {selectedReservation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          onClick={() => setSelectedReservation(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {getGuestName(selectedReservation.guest)}
                </h2>

                {selectedReservation.booking_reference && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedReservation.booking_reference}
                  </p>
                )}
              </div>

              <div className="flex flex-col items-end gap-1.5">
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${getStatusBadgeClasses(
                    selectedReservation.status
                  )}`}
                >
                  {selectedReservation.status ?? "unknown"}
                </span>

                {isImportedReservation(
                  selectedReservation.booking_reference
                ) && (
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-700">
                    Imported via iCal
                  </span>
                )}

                {selectedReservation.needs_review && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700">
                    Needs Review
                  </span>
                )}

                {conflictingIds.has(selectedReservation.id) && (
                  <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-red-700">
                    Overlaps another reservation
                  </span>
                )}
              </div>
            </div>

            <div className="mt-5 rounded-xl bg-primary px-5 py-4 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                Total Amount
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-white">
                {formatMoney(
                  selectedReservation.total_amount,
                  selectedReservation.currency
                )}
              </p>
            </div>

            <div className="mt-5 space-y-3 text-sm">
              <QuickRow
                label="Property"
                value={
                  selectedReservation.property?.title ??
                  "Unknown property"
                }
              />

              <QuickRow
                label="Check-in"
                value={selectedReservation.check_in}
              />

              <QuickRow
                label="Check-out"
                value={selectedReservation.check_out}
              />

              <QuickRow
                label="Nights"
                value={String(
                  selectedReservation.nights ?? "—"
                )}
              />

              <QuickRow
                label="Source"
                value={selectedReservation.source}
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setSelectedReservation(null)}
                className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground/80 hover:bg-muted"
              >
                Close
              </button>

              <button
                onClick={() =>
                  router.push(
                    `/reservations/${selectedReservation.id}`
                  )
                }
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
              >
                View Full Reservation
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function LegendChip({
  dotClassName,
  label,
}: {
  dotClassName: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground/70">
      <span className={`h-2 w-2 rounded-full ${dotClassName}`} />
      {label}
    </span>
  );
}

function QuickRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">
        {value}
      </span>
    </div>
  );
}
