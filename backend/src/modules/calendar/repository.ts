/**
 * The calendar has no table of its own — it's a date-range
 * view over reservations, so it reuses the reservations
 * repository query rather than duplicating it.
 */
export { findReservationsByOrganizationInRange } from "../reservations/repository";
