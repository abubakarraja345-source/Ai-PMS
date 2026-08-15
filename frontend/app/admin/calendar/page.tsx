"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EventInput } from "@fullcalendar/core";
import { apiFetch } from "@/lib/api";
import FullCalendarView, {
  CalendarViewType,
  FullCalendarViewHandle,
} from "@/components/calendar/full-calendar-view";

interface PlatformCalendarEvent {
  id: string;
  organizationId: string;
  organizationName: string;
  propertyTitle: string;
  bookingReference: string | null;
  status: string;
  checkIn: string;
  checkOut: string;
}

function toDateOnlyString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getStatusBadgeClasses(status: string) {
  switch (status) {
    case "confirmed":
      return "bg-success/10 text-success border-success/30";
    case "pending":
      return "bg-warning/10 text-warning border-warning/30";
    case "completed":
      return "bg-primary/10 text-primary border-primary/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

/** Same v4-`!`-suffix note as the org-level calendar's EVENT_BASE_CLASSES
 * — see app/(dashboard)/calendar/page.tsx's own comment for why. */
const EVENT_BASE_CLASSES = ["rounded-md!", "border-l-4!", "shadow-none!"];

function getEventTextColor(status: string): string {
  switch (status) {
    case "confirmed":
      return "#065f46";
    case "pending":
      return "#92400e";
    case "completed":
      return "#1e40af";
    default:
      return "#1e293b";
  }
}

function getEventClassNames(status: string): string[] {
  switch (status) {
    case "confirmed":
      return [...EVENT_BASE_CLASSES, "bg-emerald-50!", "border-emerald-500!", "text-emerald-800!"];
    case "pending":
      return [...EVENT_BASE_CLASSES, "bg-amber-50!", "border-amber-500!", "text-amber-800!"];
    case "completed":
      return [...EVENT_BASE_CLASSES, "bg-blue-50!", "border-blue-500!", "text-blue-800!"];
    default:
      return [...EVENT_BASE_CLASSES, "bg-slate-50!", "border-slate-400!", "text-slate-800!"];
  }
}

export default function PlatformCalendarPage() {
  const calendarRef = useRef<FullCalendarViewHandle>(null);

  const [view, setView] = useState<CalendarViewType>("dayGridMonth");
  const [rangeTitle, setRangeTitle] = useState("");
  const [visibleRange, setVisibleRange] = useState<{ start: string; end: string } | null>(null);

  const [events, setEvents] = useState<PlatformCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<PlatformCalendarEvent | null>(null);

  const loadCalendarData = useCallback(async (start: string, end: string) => {
    try {
      setLoading(true);
      setError("");

      const response = await apiFetch(
        `/api/platform-admin/calendar?start=${start}&end=${end}`
      );

      setEvents(response.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load calendar");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visibleRange) return;
    loadCalendarData(visibleRange.start, visibleRange.end);
  }, [visibleRange, loadCalendarData]);

  function handleDatesSet(info: { start: Date; end: Date; title: string }) {
    setRangeTitle(info.title);
    setVisibleRange({ start: toDateOnlyString(info.start), end: toDateOnlyString(info.end) });
  }

  function handleEventClick(reservationId: string) {
    const match = events.find((e) => e.id === reservationId);
    if (match) setSelected(match);
  }

  const calendarEvents: EventInput[] = events.map((e) => ({
    id: e.id,
    title: e.organizationName,
    start: e.checkIn,
    end: e.checkOut,
    allDay: true,
    classNames: getEventClassNames(e.status),
    extendedProps: {
      propertyTitle: e.propertyTitle,
      textColor: getEventTextColor(e.status),
    },
  }));

  return (
    <div>
      <h1 className="text-3xl font-semibold text-foreground">Platform Calendar</h1>
      <p className="mt-2 text-muted-foreground">
        Every organization&apos;s reservations, in one view. No guest details are shown here.
      </p>

      <div className="glass-panel mt-6 flex flex-col gap-3 rounded-2xl p-4 md:flex-row md:items-center md:justify-between">
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

          <span className="ml-1 text-sm font-medium text-foreground">{rangeTitle}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-border">
            <button
              onClick={() => setView("dayGridMonth")}
              className={`px-3 py-2 text-sm font-medium transition ${
                view === "dayGridMonth" ? "bg-primary text-primary-foreground" : "text-foreground/80 hover:bg-muted"
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setView("timeGridWeek")}
              className={`border-l border-border px-3 py-2 text-sm font-medium transition ${
                view === "timeGridWeek" ? "bg-primary text-primary-foreground" : "text-foreground/80 hover:bg-muted"
              }`}
            >
              Week
            </button>
          </div>

          <button
            onClick={() => visibleRange && loadCalendarData(visibleRange.start, visibleRange.end)}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-muted"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      <div className="glass-panel relative mt-4 overflow-x-auto rounded-2xl p-2 md:p-4">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-background/70">
            <span className="text-sm text-muted-foreground">Loading calendar...</span>
          </div>
        )}

        <div className="min-w-[640px]">
          <FullCalendarView
            ref={calendarRef}
            events={calendarEvents}
            initialView={view}
            onDatesSet={handleDatesSet}
            onEventClick={handleEventClick}
          />
        </div>

        {!loading && events.length === 0 && !error && (
          <p className="mt-3 text-center text-sm text-muted-foreground/80">
            No reservations in this range.
          </p>
        )}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{selected.organizationName}</h2>
                {selected.bookingReference && (
                  <p className="mt-1 text-sm text-muted-foreground">{selected.bookingReference}</p>
                )}
              </div>

              <span
                className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${getStatusBadgeClasses(selected.status)}`}
              >
                {selected.status}
              </span>
            </div>

            <div className="mt-5 space-y-3 text-sm">
              <QuickRow label="Property" value={selected.propertyTitle} />
              <QuickRow label="Check-in" value={selected.checkIn} />
              <QuickRow label="Check-out" value={selected.checkOut} />
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelected(null)}
                className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-foreground/80 hover:bg-muted"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QuickRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
