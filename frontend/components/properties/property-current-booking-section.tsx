"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface ConflictInfo {
  reservationId: string;
  checkIn: string;
  checkOut: string;
  guestName: string;
  status: string | null;
}

interface PropertyCurrentBookingSectionProps {
  propertyId: string;
}

/**
 * Today's date as YYYY-MM-DD, compared in UTC — no organization/
 * property timezone configuration exists anywhere in the schema (the
 * backend's date validation uses the same UTC convention; see
 * reservations/validation.ts), so this is the same honest calendar-day
 * comparison used everywhere else in this codebase rather than a
 * fabricated timezone-aware one.
 */
function todayUTCDateString(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function tomorrowUTCDateString(): string {
  const now = new Date();
  const tomorrow = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1
    )
  );
  const year = tomorrow.getUTCFullYear();
  const month = String(tomorrow.getUTCMonth() + 1).padStart(2, "0");
  const day = String(tomorrow.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function PropertyCurrentBookingSection({
  propertyId,
}: PropertyCurrentBookingSectionProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [occupied, setOccupied] = useState(false);
  const [current, setCurrent] = useState<ConflictInfo | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams({
          start: todayUTCDateString(),
          end: tomorrowUTCDateString(),
        });

        const response = await apiFetch(
          `/api/properties/${propertyId}/availability?${params.toString()}`
        );

        if (cancelled) return;

        setOccupied(!response.data.available);
        setCurrent(response.data.conflicts?.[0] ?? null);
      } catch (err) {
        if (cancelled) return;

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load current booking status"
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (propertyId) {
      load();
    }

    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-foreground">
        {occupied ? "Current Booking" : "Availability"}
      </h2>

      <p className="mt-1 text-sm text-muted-foreground">
        Whether this property has an active booking today.
      </p>

      <div className="mt-5">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : occupied && current ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <span className="inline-flex rounded-full border border-amber-300 bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
              Occupied
            </span>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Guest
                </p>
                <p className="mt-1 font-medium text-foreground">
                  {current.guestName}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Check-in
                </p>
                <p className="mt-1 font-medium text-foreground">
                  {formatDate(current.checkIn)}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Check-out
                </p>
                <p className="mt-1 font-medium text-foreground">
                  {formatDate(current.checkOut)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <span className="inline-flex rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
              Currently Available
            </span>

            <p className="mt-2 text-sm text-emerald-800">
              No active booking.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
