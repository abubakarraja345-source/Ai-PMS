"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type CleaningTask = {
  id: string;
  property_id: string;
  reservation_id: string | null;
  status: string;
  priority: string;
  scheduled_date: string | null;
  assigned_to: string | null;
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
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
    case "pending":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "in_progress":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "completed":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "cancelled":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-muted text-foreground/80 border-border";
  }
}

function formatDateTime(value: string | null) {
  if (!value) return "Not provided";
  return new Date(value).toLocaleString();
}

export default function CleaningTaskDetailPage() {
  const params = useParams();
  const router = useRouter();

  const taskId = params.id as string;

  const [task, setTask] = useState<CleaningTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadTask = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await apiFetch(
        `/api/cleaning/${taskId}`
      );

      setTask(response.data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load cleaning task."
      );
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (taskId) {
      loadTask();
    }
  }, [taskId, loadTask]);

  async function changeStatus(status: string) {
    try {
      setSaving(true);
      setError("");

      await apiFetch(`/api/cleaning/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });

      await loadTask();
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
      <main className="min-h-screen bg-background px-6 py-10">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl border border-border bg-card p-8">
            Loading cleaning task...
          </div>
        </div>
      </main>
    );
  }

  if (error && !task) {
    return (
      <main className="min-h-screen bg-background px-6 py-10">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
            {error}
          </div>

          <button
            onClick={() => router.push("/cleaning")}
            className="mt-5 rounded-xl bg-primary px-5 py-3 text-white"
          >
            Back to Cleaning
          </button>
        </div>
      </main>
    );
  }

  if (!task) return null;

  const guestName = task.reservation?.guest
    ? `${task.reservation.guest.first_name} ${
        task.reservation.guest.last_name ?? ""
      }`.trim()
    : null;

  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-start">
          <div>
            <button
              onClick={() => router.push("/cleaning")}
              className="mb-4 text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back to Cleaning
            </button>

            <div className="flex items-center gap-4">
              <h1 className="text-4xl font-semibold tracking-tight text-foreground">
                {task.property?.title ??
                  "Unknown property"}
              </h1>

              <span
                className={`rounded-full border px-3 py-1 text-sm font-medium capitalize ${getStatusClasses(
                  task.status
                )}`}
              >
                {task.status.replace("_", " ")}
              </span>
            </div>

            <p className="mt-2 capitalize text-muted-foreground">
              {task.priority} priority
              {task.scheduled_date
                ? ` · Scheduled ${task.scheduled_date}`
                : ""}
            </p>
          </div>

          <button
            onClick={() =>
              router.push(`/cleaning/${task.id}/edit`)
            }
            className="rounded-xl bg-primary px-6 py-3 font-medium text-white hover:opacity-90"
          >
            Edit Task
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Actions */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-foreground">
            Actions
          </h2>

          <div className="mt-5 flex flex-wrap gap-3">
            {task.status === "pending" && (
              <>
                <button
                  disabled={saving}
                  onClick={() => changeStatus("in_progress")}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Start Cleaning
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

            {task.status === "in_progress" && (
              <>
                <button
                  disabled={saving}
                  onClick={() => changeStatus("completed")}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Mark Completed
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

            {task.status === "completed" && (
              <button
                disabled={saving}
                onClick={() => changeStatus("in_progress")}
                className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-foreground/80 hover:bg-muted disabled:opacity-50"
              >
                Reopen Task
              </button>
            )}

            {task.status === "cancelled" && (
              <p className="text-sm text-muted-foreground/80">
                This task has been cancelled and has no
                further actions.
              </p>
            )}
          </div>
        </section>

        {/* Details */}
        <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-foreground">
            Task Details
          </h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <DetailRow
              label="Property"
              value={
                task.property?.title ?? "Unknown property"
              }
            />
            <DetailRow
              label="Assigned To"
              value={task.assigned_to}
            />
            <DetailRow
              label="Scheduled Date"
              value={task.scheduled_date}
            />
            <DetailRow
              label="Priority"
              value={task.priority}
            />
          </div>
        </section>

        {/* Reservation */}
        <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-foreground">
            Linked Reservation
          </h2>

          {task.reservation ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <DetailRow
                label="Booking Reference"
                value={task.reservation.booking_reference}
              />
              <DetailRow label="Guest" value={guestName} />
              <DetailRow
                label="Check-in"
                value={task.reservation.check_in}
              />
              <DetailRow
                label="Check-out"
                value={task.reservation.check_out}
              />
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground/80">
              Not linked to a reservation.
            </p>
          )}
        </section>

        {/* Notes */}
        <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-foreground">
            Notes
          </h2>

          <p className="mt-4 leading-7 text-foreground/70">
            {task.notes || "No notes provided."}
          </p>
        </section>

        {/* Timeline */}
        <section className="mt-6 mb-10 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-foreground">
            Timeline
          </h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <DetailRow
              label="Started At"
              value={formatDateTime(task.started_at)}
            />
            <DetailRow
              label="Completed At"
              value={formatDateTime(task.completed_at)}
            />
            <DetailRow
              label="Created"
              value={formatDateTime(task.created_at)}
            />
            <DetailRow
              label="Last Updated"
              value={formatDateTime(task.updated_at)}
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
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-medium capitalize text-foreground">
        {value || "Not provided"}
      </p>
    </div>
  );
}
