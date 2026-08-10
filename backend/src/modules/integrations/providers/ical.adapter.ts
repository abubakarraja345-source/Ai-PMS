import * as ical from "node-ical";
import { ExternalEvent, ProviderAdapter } from "./types";

const FETCH_TIMEOUT_MS = 15000;
const MAX_FEED_BYTES = 5 * 1024 * 1024; // 5MB — a sane cap for a calendar feed

/**
 * node-ical constructs date-only (VALUE=DATE) values using the
 * local-timezone Date constructor (new Date(y, m, d)), not UTC —
 * so extracting via local calendar getters is correct here, while
 * .toISOString() would shift the date by the server's UTC offset
 * (confirmed live: a positive-offset server showed events a day
 * early). This is specifically for the all-day values OTA iCal
 * exports use for check-in/check-out, not arbitrary timestamps.
 */
function toDateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function fetchFeedText(feedUrl: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(feedUrl, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(
        `Feed request failed with status ${response.status}`
      );
    }

    const contentLength = response.headers.get("content-length");

    if (contentLength && Number(contentLength) > MAX_FEED_BYTES) {
      throw new Error("Feed is too large to process");
    }

    const text = await response.text();

    if (text.length > MAX_FEED_BYTES) {
      throw new Error("Feed is too large to process");
    }

    return text;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Feed request timed out");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Parses a subset of RFC 5545 (VEVENT UID/DTSTART/DTEND/STATUS)
 * sufficient to represent booking availability blocks — the shape
 * every real OTA iCal export (Airbnb, Booking.com, VRBO) uses.
 */
export const icalAdapter: ProviderAdapter = {
  providerId: "ical",
  isSupported: true,

  async fetchEvents(config): Promise<ExternalEvent[]> {
    if (!config.feedUrl) {
      throw new Error("No feed URL configured");
    }

    let parsedUrl: URL;

    try {
      parsedUrl = new URL(config.feedUrl);
    } catch {
      throw new Error("Feed URL is not a valid URL");
    }

    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      throw new Error("Feed URL must be http or https");
    }

    const text = await fetchFeedText(config.feedUrl);

    // node-ical parses garbage text without throwing (it just finds
    // no components) — a real feed always starts with this line, so
    // its absence is treated as "not an iCal feed" rather than "an
    // empty calendar".
    if (!text.includes("BEGIN:VCALENDAR")) {
      throw new Error("Feed content is not valid iCal data");
    }

    let parsed: ical.CalendarResponse;

    try {
      parsed = ical.parseICS(text);
    } catch {
      throw new Error("Feed content is not valid iCal data");
    }

    const events: ExternalEvent[] = [];

    for (const component of Object.values(parsed)) {
      if (!component || component.type !== "VEVENT") continue;

      const uid = component.uid;
      const start = component.start;
      const end = component.end;

      // Malformed/incomplete VEVENTs are skipped, not fatal to the
      // whole sync — reported back to the caller as skipped counts.
      if (!uid || !start || !end) continue;

      const status =
        typeof component.status === "string"
          ? component.status.toUpperCase()
          : "";

      events.push({
        externalId: String(uid),
        checkIn: toDateOnly(new Date(start)),
        checkOut: toDateOnly(new Date(end)),
        summary:
          typeof component.summary === "string" ? component.summary : null,
        isCancelled: status === "CANCELLED",
      });
    }

    return events;
  },
};
