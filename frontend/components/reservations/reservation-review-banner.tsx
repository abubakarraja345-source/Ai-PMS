"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { usePermission } from "@/lib/permission-context";

export default function ReservationReviewBanner({
  reservationId,
  initialNeedsReview,
}: {
  reservationId: string;
  initialNeedsReview: boolean;
}) {
  const router = useRouter();

  // Was previously a separate, hardcoded owner/company_admin check via
  // its own GET /api/organization/members call — stale from before
  // Phase 7's 6-role permission engine existed, so a Manager (who the
  // backend's matrix already grants reservations.review to — see
  // permissions/matrix.ts) saw the "Review Required" flag with no way
  // to act on it at all. usePermission() reads the same effective-
  // permissions data the backend itself enforces, so this can't drift
  // out of sync again.
  const { can } = usePermission();
  const canManage = can("reservations.review");

  const [needsReview, setNeedsReview] = useState(initialNeedsReview);
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState("");
  const [justCleared, setJustCleared] = useState(false);

  async function handleClear() {
    try {
      setClearing(true);
      setError("");

      await apiFetch(`/api/reservations/${reservationId}/review`, {
        method: "PATCH",
      });

      setNeedsReview(false);
      setConfirming(false);
      setJustCleared(true);

      // The parent reservation detail page is a server component that
      // fetches on every request — refresh (not a full navigation) so
      // it re-fetches with the now-cleared flag instead of forcing a
      // hard page reload.
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update reservation."
      );
    } finally {
      setClearing(false);
    }
  }

  if (!needsReview) {
    if (justCleared) {
      return (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
          Reservation marked as reviewed.
        </div>
      );
    }

    return null;
  }

  return (
    <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-center gap-2">
        <span className="rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
          Review Required
        </span>
      </div>

      <p className="mt-3 text-sm text-amber-900">
        This reservation was imported with a scheduling conflict. Please
        review the reservation details before clearing the flag.
      </p>

      {error && (
        <p className="mt-3 text-sm text-red-700">{error}</p>
      )}

      {!canManage && (
        <p className="mt-4 text-sm text-amber-800">
          You don&apos;t have permission to clear this flag — ask an owner,
          admin, or manager to review it.
        </p>
      )}

      {canManage && (
        <>
          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              className="mt-4 rounded-lg bg-[#10172a] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#18213a]"
            >
              Review Reservation
            </button>
          ) : (
            <div className="mt-4 rounded-xl border border-amber-300 bg-white p-4">
              <p className="font-medium text-slate-900">
                Mark as Reviewed?
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Confirm that you have reviewed this reservation and want
                to remove the review flag.
              </p>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setConfirming(false)}
                  disabled={clearing}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  onClick={handleClear}
                  disabled={clearing}
                  className="rounded-lg bg-[#10172a] px-4 py-2 text-sm font-medium text-white hover:bg-[#18213a] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {clearing ? "Marking..." : "Mark as Reviewed"}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
