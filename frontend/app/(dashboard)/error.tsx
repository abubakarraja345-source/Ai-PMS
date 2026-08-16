"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function DashboardError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard route error:", error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center bg-muted px-6 py-10">
      <div className="w-full max-w-md rounded-2xl border border-red-200 bg-red-50 p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-red-800">
          Something went wrong
        </h1>

        <p className="mt-2 text-sm text-red-700">
          {error.message || "An unexpected error occurred while loading this page."}
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => retry()}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            Try again
          </button>

          <Link
            href="/dashboard"
            className="rounded-xl border border-red-200 bg-card px-5 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
