import crypto from "crypto";
import {
  findExportableReservations,
  findPropertyByExportTokenHash,
} from "./repository";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function toIcsDateOnly(date: string): string {
  return date.replace(/-/g, "");
}

function toIcsTimestamp(isoDate: string): string {
  const compact = new Date(isoDate).toISOString().replace(/[-:]/g, "");
  const dotIndex = compact.indexOf(".");

  return `${dotIndex === -1 ? compact : compact.slice(0, dotIndex)}Z`;
}

export interface IcsFeedResult {
  content: string;
}

/**
 * Builds a minimal availability-only iCal feed for one property,
 * looked up by export token alone (never by property ID — see
 * repository.ts's comment on why). Deliberately excludes every field
 * an external calendar provider doesn't need to block dates: no guest
 * name/email/phone, no financial figures, no special requests, no
 * organization identifiers. Every VEVENT's SUMMARY is the fixed
 * string "Reserved" regardless of source (Airbnb/Booking.com/VRBO/
 * Direct/iCal) — this feed is meant to travel to those same external
 * providers, so it must never re-expose which channel a booking came
 * from or any other internal metadata.
 */
export async function buildIcsFeedForToken(
  rawToken: string
): Promise<IcsFeedResult> {
  const property = await findPropertyByExportTokenHash(hashToken(rawToken));

  if (!property) {
    throw new Error("Feed not found");
  }

  const reservations = await findExportableReservations(property.id);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Hostly PMS//Calendar Export//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const reservation of reservations) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:pms-${reservation.id}@hostly-export`,
      `DTSTAMP:${toIcsTimestamp(reservation.updated_at)}`,
      `DTSTART;VALUE=DATE:${toIcsDateOnly(reservation.check_in)}`,
      `DTEND;VALUE=DATE:${toIcsDateOnly(reservation.check_out)}`,
      "SUMMARY:Reserved",
      "STATUS:CONFIRMED",
      "TRANSP:OPAQUE",
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");

  return { content: lines.join("\r\n") };
}
