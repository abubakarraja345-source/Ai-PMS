"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { Calendar, EventInput } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

export type CalendarViewType = "dayGridMonth" | "timeGridWeek";

export interface FullCalendarViewHandle {
  prev: () => void;
  next: () => void;
  today: () => void;
}

interface FullCalendarViewProps {
  events: EventInput[];
  initialView: CalendarViewType;
  onDatesSet: (info: {
    start: Date;
    end: Date;
    title: string;
  }) => void;
  onEventClick: (reservationId: string) => void;
}

/**
 * A thin React wrapper around @fullcalendar/core's vanilla
 * Calendar class.
 *
 * This project's installed @fullcalendar/react is v7, which
 * is built on a different underlying engine and its own
 * bundled plugin subpaths — it is NOT compatible with the
 * v6.1.21 @fullcalendar/core + daygrid/timegrid/interaction
 * plugins that are also installed. Rather than add a new
 * dependency to bridge that gap, this wrapper drives the
 * actually-compatible v6 core/plugins directly, the same way
 * FullCalendar's own React wrapper does internally.
 */
const FullCalendarView = forwardRef<
  FullCalendarViewHandle,
  FullCalendarViewProps
>(function FullCalendarView(
  { events, initialView, onDatesSet, onEventClick },
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const calendarRef = useRef<Calendar | null>(null);

  // Keep latest callbacks available to the calendar instance
  // without needing to recreate it on every parent re-render.
  const onDatesSetRef = useRef(onDatesSet);
  const onEventClickRef = useRef(onEventClick);
  onDatesSetRef.current = onDatesSet;
  onEventClickRef.current = onEventClick;

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const calendar = new Calendar(containerRef.current, {
      plugins: [
        dayGridPlugin,
        timeGridPlugin,
        interactionPlugin,
      ],
      initialView,
      headerToolbar: false,
      height: "auto",
      firstDay: 1,
      dayMaxEventRows: 3,
      nowIndicator: true,
      events: [],

      datesSet: (arg) => {
        onDatesSetRef.current({
          start: arg.start,
          end: arg.end,
          title: arg.view.title,
        });
      },

      eventClick: (arg) => {
        onEventClickRef.current(arg.event.id);
      },

      eventContent: (arg) => {
        const wrapper = document.createElement("div");
        wrapper.className = "px-0.5 py-px overflow-hidden";

        const titleEl = document.createElement("div");
        titleEl.className =
          "truncate text-[11px] font-medium leading-tight";
        titleEl.textContent = arg.event.title;
        wrapper.appendChild(titleEl);

        const propertyTitle = arg.event.extendedProps
          .propertyTitle as string | undefined;

        if (propertyTitle) {
          const subEl = document.createElement("div");
          subEl.className =
            "truncate text-[10px] leading-tight opacity-80";
          subEl.textContent = propertyTitle;
          wrapper.appendChild(subEl);
        }

        return { domNodes: [wrapper] };
      },
    });

    calendar.render();
    calendarRef.current = calendar;

    return () => {
      calendar.destroy();
      calendarRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    calendarRef.current?.resetOptions(
      { events },
      ["events"]
    );
  }, [events]);

  useEffect(() => {
    calendarRef.current?.changeView(initialView);
  }, [initialView]);

  useImperativeHandle(ref, () => ({
    prev: () => calendarRef.current?.prev(),
    next: () => calendarRef.current?.next(),
    today: () => calendarRef.current?.today(),
  }));

  return <div ref={containerRef} />;
});

export default FullCalendarView;
