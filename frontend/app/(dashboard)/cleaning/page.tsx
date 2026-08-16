"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { PaginationControls } from "@/components/shared/pagination-controls";

interface PropertyOption {
  id: string;
  title: string;
}

interface GuestSummary {
  id: string;
  first_name: string;
  last_name: string | null;
}

interface ReservationSummary {
  id: string;
  check_in: string;
  check_out: string;
  booking_reference: string | null;
  guest?: GuestSummary | null;
}

interface CleaningTask {
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
  property?: PropertyOption | null;
  reservation?: ReservationSummary | null;
}

function getGuestName(guest: GuestSummary | null | undefined) {
  if (!guest) return null;
  return `${guest.first_name} ${guest.last_name ?? ""}`.trim();
}

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

function getPriorityClasses(priority: string) {
  switch (priority) {
    case "urgent":
      return "bg-red-50 text-red-700 border-red-200";
    case "high":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "low":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-muted text-foreground/80 border-border";
  }
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00Z`).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric" }
  );
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function CleaningPage() {
  const [tasks, setTasks] = useState<CleaningTask[]>([]);
  const [properties, setProperties] = useState<
    PropertyOption[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(
    null
  );
  const [error, setError] = useState("");

  const [propertyFilter, setPropertyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [startFilter, setStartFilter] = useState("");
  const [endFilter, setEndFilter] = useState("");
  const [assignedToFilter, setAssignedToFilter] = useState("");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Any filter change invalidates the current page — page 1 of a new
  // filtered set is the only page guaranteed to exist.
  useEffect(() => {
    setPage(1);
  }, [
    propertyFilter,
    statusFilter,
    priorityFilter,
    startFilter,
    endFilter,
    assignedToFilter,
  ]);

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();
      if (propertyFilter !== "all")
        params.set("property_id", propertyFilter);
      if (statusFilter !== "all")
        params.set("status", statusFilter);
      if (priorityFilter !== "all")
        params.set("priority", priorityFilter);
      if (startFilter) params.set("start", startFilter);
      if (endFilter) params.set("end", endFilter);
      if (assignedToFilter.trim())
        params.set("assigned_to", assignedToFilter.trim());
      params.set("page", String(page));

      const query = params.toString();

      const response = await apiFetch(
        `/api/cleaning${query ? `?${query}` : ""}`
      );

      setTasks(response.data ?? []);
      setTotalPages(response.meta?.totalPages ?? 1);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load cleaning tasks"
      );
    } finally {
      setLoading(false);
    }
  }, [
    propertyFilter,
    statusFilter,
    priorityFilter,
    startFilter,
    endFilter,
    assignedToFilter,
    page,
  ]);

  useEffect(() => {
    async function loadProperties() {
      try {
        const response = await apiFetch("/api/properties?limit=100");
        setProperties(response.data ?? []);
      } catch {
        // Non-fatal — the property filter simply won't populate.
      }
    }

    loadProperties();
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  async function deleteTask(taskId: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this cleaning task?\n\nThis action cannot be undone."
    );

    if (!confirmed) return;

    try {
      setDeletingId(taskId);
      setError("");

      await apiFetch(`/api/cleaning/${taskId}`, {
        method: "DELETE",
      });

      setTasks((current) =>
        current.filter((task) => task.id !== taskId)
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete cleaning task"
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-background p-4 md:p-10">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h1 className="text-3xl font-semibold text-foreground md:text-5xl">
            Cleaning / Housekeeping
          </h1>

          <p className="mt-2 text-muted-foreground md:mt-3 md:text-lg">
            Manage turnover cleaning and housekeeping tasks.
          </p>
        </div>

        <button
          onClick={() => {
            window.location.href = "/cleaning/new";
          }}
          className="rounded-xl bg-gradient-to-r from-primary to-accent px-6 py-4 text-white hover:opacity-90"
        >
          + New Cleaning Task
        </button>
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <select
          value={propertyFilter}
          onChange={(e) => setPropertyFilter(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground/80 outline-none focus:border-primary"
        >
          <option value="all">All properties</option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.title}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground/80 outline-none focus:border-primary"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground/80 outline-none focus:border-primary"
        >
          <option value="all">All priorities</option>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>

        <input
          type="date"
          value={startFilter}
          onChange={(e) => setStartFilter(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground/80 outline-none focus:border-primary"
        />

        <span className="text-sm text-muted-foreground/80">to</span>

        <input
          type="date"
          value={endFilter}
          onChange={(e) => setEndFilter(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground/80 outline-none focus:border-primary"
        />

        <input
          type="text"
          value={assignedToFilter}
          onChange={(e) => setAssignedToFilter(e.target.value)}
          placeholder="Assigned to..."
          className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground/80 outline-none focus:border-primary"
        />

        <button
          onClick={loadTasks}
          className="ml-auto rounded-lg border border-border px-3 py-2.5 text-sm font-medium text-foreground/80 hover:bg-muted"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-10 text-muted-foreground">
          Loading cleaning tasks...
        </div>
      ) : tasks.length === 0 ? (
        <div className="mt-10 rounded-2xl border bg-card p-10 text-center">
          <h2 className="text-2xl font-semibold text-foreground">
            No cleaning tasks yet
          </h2>

          <p className="mt-2 text-muted-foreground">
            Create a cleaning task to start tracking turnover
            and housekeeping work.
          </p>
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground/80">
                <th className="px-5 py-3 font-medium">
                  Property
                </th>
                <th className="px-5 py-3 font-medium">
                  Scheduled
                </th>
                <th className="px-5 py-3 font-medium">
                  Reservation / Guest
                </th>
                <th className="px-5 py-3 font-medium">
                  Priority
                </th>
                <th className="px-5 py-3 font-medium">
                  Status
                </th>
                <th className="px-5 py-3 font-medium">
                  Assigned
                </th>
                <th className="px-5 py-3 font-medium">
                  Started / Completed
                </th>
                <th className="px-5 py-3 font-medium">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {tasks.map((task) => {
                const guestName = getGuestName(
                  task.reservation?.guest
                );

                return (
                  <tr
                    key={task.id}
                    className="border-b border-border/60 last:border-0 hover:bg-muted/60"
                  >
                    <td className="px-5 py-4 font-medium text-foreground">
                      {task.property?.title ??
                        "Unknown property"}
                    </td>

                    <td className="px-5 py-4 text-foreground/80">
                      {formatDate(task.scheduled_date)}
                    </td>

                    <td className="px-5 py-4 text-foreground/80">
                      {task.reservation ? (
                        <>
                          <p>
                            {task.reservation
                              .booking_reference ??
                              "—"}
                          </p>
                          {guestName && (
                            <p className="text-xs text-muted-foreground/80">
                              {guestName}
                            </p>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground/80">
                          —
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${getPriorityClasses(
                          task.priority
                        )}`}
                      >
                        {task.priority}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${getStatusClasses(
                          task.status
                        )}`}
                      >
                        {task.status.replace("_", " ")}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-foreground/80">
                      {task.assigned_to ?? (
                        <span className="text-muted-foreground/80">
                          Unassigned
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4 text-xs text-muted-foreground">
                      <p>
                        Started:{" "}
                        {formatDateTime(task.started_at)}
                      </p>
                      <p>
                        Completed:{" "}
                        {formatDateTime(task.completed_at)}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            (window.location.href = `/cleaning/${task.id}`)
                          }
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-muted"
                        >
                          View
                        </button>

                        <button
                          onClick={() =>
                            (window.location.href = `/cleaning/${task.id}/edit`)
                          }
                          className="rounded-lg bg-gradient-to-r from-primary to-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => deleteTask(task.id)}
                          disabled={deletingId === task.id}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingId === task.id
                            ? "Deleting..."
                            : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <PaginationControls
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </main>
  );
}
