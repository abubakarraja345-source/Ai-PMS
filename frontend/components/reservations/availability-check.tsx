"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

interface ConflictInfo {
  reservationId: string;
  checkIn: string;
  checkOut: string;
  guestName: string;
  status: string | null;
}

interface AvailabilityCheckProps {
  propertyId: string;
  checkIn: string;
  checkOut: string;
  /** Excludes a reservation's own dates from counting as a conflict
   * with itself when checking availability during an edit. */
  excludeReservationId?: string;
  onAvailabilityChange?: (available: boolean | null) => void;
}

const DEBOUNCE_MS = 500;

/**
 * Live availability feedback for the create/edit reservation forms.
 * This is UX only — backend validation on submit remains authoritative
 * (see reservations/service.ts's assertAvailableOrThrow, which runs
 * regardless of what this component reports).
 */
export default function AvailabilityCheck({
  propertyId,
  checkIn,
  checkOut,
  excludeReservationId,
  onAvailabilityChange,
}: AvailabilityCheckProps) {
  const [status, setStatus] = useState<
    "idle" | "checking" | "available" | "unavailable" | "error"
  >("idle");
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const onAvailabilityChangeRef = useRef(onAvailabilityChange);
  onAvailabilityChangeRef.current = onAvailabilityChange;

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (!propertyId || !checkIn || !checkOut || checkOut <= checkIn) {
      setStatus("idle");
      setConflict(null);
      onAvailabilityChangeRef.current?.(null);
      return;
    }

    setStatus("checking");
    const requestId = ++requestIdRef.current;

    timeoutRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          start: checkIn,
          end: checkOut,
        });

        if (excludeReservationId) {
          params.set("exclude_reservation_id", excludeReservationId);
        }

        const response = await apiFetch(
          `/api/properties/${propertyId}/availability?${params.toString()}`
        );

        // A later keystroke may have already started a newer check —
        // ignore this now-stale response instead of flashing an old
        // result.
        if (requestIdRef.current !== requestId) return;

        if (response.data.available) {
          setStatus("available");
          setConflict(null);
          onAvailabilityChangeRef.current?.(true);
        } else {
          setStatus("unavailable");
          setConflict(response.data.conflicts[0] ?? null);
          onAvailabilityChangeRef.current?.(false);
        }
      } catch {
        if (requestIdRef.current !== requestId) return;

        // Non-fatal — the live check simply won't render a result;
        // submitting still goes through real backend validation.
        setStatus("error");
        setConflict(null);
        onAvailabilityChangeRef.current?.(null);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [propertyId, checkIn, checkOut, excludeReservationId]);

  if (status === "idle" || status === "error") {
    return null;
  }

  if (status === "checking") {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        Checking availability...
      </p>
    );
  }

  if (status === "available") {
    return (
      <p className="mt-2 text-sm font-medium text-emerald-700">
        ✓ Property available
      </p>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      <p className="font-medium">Property unavailable</p>

      {conflict && (
        <>
          <p className="mt-1">
            Already booked from {conflict.checkIn} to {conflict.checkOut}
          </p>

          <p className="mt-1">Guest: {conflict.guestName}</p>
        </>
      )}
    </div>
  );
}
