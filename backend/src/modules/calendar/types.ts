import { ReservationListItem } from "../reservations/types";

/**
 * The calendar has no storage of its own — it's a date-range
 * view over the reservations table, so it returns the same
 * shape reservations already use.
 */
export type CalendarReservation = ReservationListItem;
