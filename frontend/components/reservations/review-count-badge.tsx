"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

const POLL_MS = 60000;

/**
 * Reuses the existing paginated reservations list endpoint with
 * limit=1 rather than a dedicated count endpoint — the total is
 * already computed server-side via Postgres's exact count regardless
 * of the limit clause (see backend/src/utils/pagination.ts), so this
 * transfers one row, not the whole review queue, matching
 * NotificationBell's same "poll a cheap count" pattern.
 */
export default function ReviewCountBadge() {
  const [count, setCount] = useState<number | null>(null);

  const loadCount = useCallback(async () => {
    try {
      const response = await apiFetch(
        "/api/reservations?needs_review=true&limit=1"
      );
      setCount(response.meta?.total ?? 0);
    } catch {
      // Silent — the badge just won't render this cycle.
    }
  }, []);

  useEffect(() => {
    loadCount();

    const interval = setInterval(loadCount, POLL_MS);
    return () => clearInterval(interval);
  }, [loadCount]);

  if (!count) return null;

  return (
    <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-warning px-1.5 text-xs font-semibold text-warning-foreground">
      {count > 99 ? "99+" : count}
    </span>
  );
}
