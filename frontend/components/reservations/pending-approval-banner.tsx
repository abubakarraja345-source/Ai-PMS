"use client";

import { useSearchParams } from "next/navigation";

/**
 * Shown when the reservation edit form redirects here after a 202
 * "pending approval" response (Phase 7.3) — the change was NOT
 * applied; it's waiting for a senior role to approve it. Distinct
 * from ReservationReviewBanner (which is about a sync-imported
 * scheduling conflict, an unrelated concept).
 */
export default function PendingApprovalBanner() {
  const searchParams = useSearchParams();

  if (searchParams.get("pendingApproval") !== "1") {
    return null;
  }

  return (
    <div className="mb-6 rounded-2xl border border-violet-200 bg-violet-50 p-5 text-sm text-violet-900">
      <p className="font-medium">Change submitted for approval</p>
      <p className="mt-1 text-violet-800">
        Your edit was not applied yet — it requires approval from a manager,
        admin, or owner first. You&apos;ll be notified once it&apos;s reviewed. The
        reservation still shows its current, unchanged details below.
      </p>
    </div>
  );
}
