"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { formatMoney as formatMoneyShared } from "@/lib/currency";

type MaintenanceTicket = {
  id: string;
  property_id: string;
  reservation_id: string | null;
  reported_by: string | null;
  assigned_to: string | null;
  category: string | null;
  priority: string;
  status: string;
  title: string;
  description: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  opened_at: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  property?: { id: string; title: string } | null;
  reservation?: {
    id: string;
    check_in: string;
    check_out: string;
    booking_reference: string | null;
    guest?: {
      id: string;
      first_name: string;
      last_name: string | null;
    } | null;
  } | null;
};

function getStatusClasses(status: string) {
  switch (status) {
    case "open":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "in_progress":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "resolved":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "closed":
      return "bg-slate-100 text-slate-600 border-slate-200";
    case "cancelled":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

/**
 * Maintenance tickets have no currency field (see Phase 5's currency
 * audit — internal repair-cost estimates, never guest-facing, out of
 * scope for multi-currency support) — always formatted as USD,
 * unchanged from before, just routed through the shared formatter for
 * consistent rounding/precision behavior.
 */
function formatMoney(amount: number | null) {
  return formatMoneyShared(amount, "USD");
}

function formatDateTime(value: string | null) {
  if (!value) return "Not provided";
  return new Date(value).toLocaleString();
}

export default function MaintenanceTicketDetailPage() {
  const params = useParams();
  const router = useRouter();

  const ticketId = params.id as string;

  const [ticket, setTicket] =
    useState<MaintenanceTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadTicket = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await apiFetch(
        `/api/maintenance/${ticketId}`
      );

      setTicket(response.data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load maintenance ticket."
      );
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    if (ticketId) {
      loadTicket();
    }
  }, [ticketId, loadTicket]);

  async function changeStatus(status: string) {
    try {
      setSaving(true);
      setError("");

      await apiFetch(`/api/maintenance/${ticketId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });

      await loadTicket();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update status."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-8">
            Loading maintenance ticket...
          </div>
        </div>
      </main>
    );
  }

  if (error && !ticket) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
            {error}
          </div>

          <button
            onClick={() => router.push("/maintenance")}
            className="mt-5 rounded-xl bg-slate-900 px-5 py-3 text-white"
          >
            Back to Maintenance
          </button>
        </div>
      </main>
    );
  }

  if (!ticket) return null;

  const guestName = ticket.reservation?.guest
    ? `${ticket.reservation.guest.first_name} ${
        ticket.reservation.guest.last_name ?? ""
      }`.trim()
    : null;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-start">
          <div>
            <button
              onClick={() => router.push("/maintenance")}
              className="mb-4 text-sm text-slate-500 hover:text-slate-900"
            >
              ← Back to Maintenance
            </button>

            <div className="flex items-center gap-4">
              <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
                {ticket.title}
              </h1>

              <span
                className={`rounded-full border px-3 py-1 text-sm font-medium capitalize ${getStatusClasses(
                  ticket.status
                )}`}
              >
                {ticket.status.replace("_", " ")}
              </span>
            </div>

            <p className="mt-2 capitalize text-slate-500">
              {ticket.property?.title ??
                "Unknown property"}{" "}
              · {ticket.priority} priority
              {ticket.category ? ` · ${ticket.category}` : ""}
            </p>
          </div>

          <button
            onClick={() =>
              router.push(`/maintenance/${ticket.id}/edit`)
            }
            className="rounded-xl bg-slate-900 px-6 py-3 font-medium text-white hover:bg-slate-800"
          >
            Edit Ticket
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Actions */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">
            Actions
          </h2>

          <div className="mt-5 flex flex-wrap gap-3">
            {ticket.status === "open" && (
              <>
                <button
                  disabled={saving}
                  onClick={() => changeStatus("in_progress")}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Start Work
                </button>

                <button
                  disabled={saving}
                  onClick={() => changeStatus("cancelled")}
                  className="rounded-xl border border-red-200 px-5 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </>
            )}

            {ticket.status === "in_progress" && (
              <>
                <button
                  disabled={saving}
                  onClick={() => changeStatus("resolved")}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Mark Resolved
                </button>

                <button
                  disabled={saving}
                  onClick={() => changeStatus("cancelled")}
                  className="rounded-xl border border-red-200 px-5 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </>
            )}

            {ticket.status === "resolved" && (
              <>
                <button
                  disabled={saving}
                  onClick={() => changeStatus("closed")}
                  className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  Close Ticket
                </button>

                <button
                  disabled={saving}
                  onClick={() => changeStatus("in_progress")}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Reopen
                </button>
              </>
            )}

            {(ticket.status === "closed" ||
              ticket.status === "cancelled") && (
              <p className="text-sm text-slate-400">
                This ticket is {ticket.status} and has no
                further actions.
              </p>
            )}
          </div>
        </section>

        {/* Details */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">
            Ticket Details
          </h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <DetailRow
              label="Property"
              value={
                ticket.property?.title ??
                "Unknown property"
              }
            />
            <DetailRow
              label="Category"
              value={ticket.category}
            />
            <DetailRow
              label="Priority"
              value={ticket.priority}
            />
            <DetailRow
              label="Assigned To"
              value={ticket.assigned_to}
            />
            <DetailRow
              label="Estimated Cost"
              value={formatMoney(ticket.estimated_cost)}
            />
            <DetailRow
              label="Actual Cost"
              value={formatMoney(ticket.actual_cost)}
            />
          </div>
        </section>

        {/* Reservation */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">
            Linked Reservation
          </h2>

          {ticket.reservation ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <DetailRow
                label="Booking Reference"
                value={ticket.reservation.booking_reference}
              />
              <DetailRow label="Guest" value={guestName} />
              <DetailRow
                label="Check-in"
                value={ticket.reservation.check_in}
              />
              <DetailRow
                label="Check-out"
                value={ticket.reservation.check_out}
              />
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-400">
              Not linked to a reservation.
            </p>
          )}
        </section>

        {/* Description */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">
            Description
          </h2>

          <p className="mt-4 leading-7 text-slate-600">
            {ticket.description || "No description provided."}
          </p>
        </section>

        {/* Timeline */}
        <section className="mt-6 mb-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">
            Timeline
          </h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <DetailRow
              label="Reported By"
              value={ticket.reported_by}
            />
            <DetailRow
              label="Opened At"
              value={formatDateTime(ticket.opened_at)}
            />
            <DetailRow
              label="Resolved At"
              value={formatDateTime(ticket.resolved_at)}
            />
            <DetailRow
              label="Last Updated"
              value={formatDateTime(ticket.updated_at)}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-medium capitalize text-slate-900">
        {value || "Not provided"}
      </p>
    </div>
  );
}
