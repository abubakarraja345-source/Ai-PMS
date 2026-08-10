"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

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
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

function getPriorityClasses(priority: string) {
  switch (priority) {
    case "urgent":
      return "bg-red-50 text-red-700 border-red-200";
    case "high":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "low":
      return "bg-slate-50 text-slate-500 border-slate-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
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

      const query = params.toString();

      const response = await apiFetch(
        `/api/cleaning${query ? `?${query}` : ""}`
      );

      setTasks(response.data ?? []);
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
  ]);

  useEffect(() => {
    async function loadProperties() {
      try {
        const response = await apiFetch("/api/properties");
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
    <main className="min-h-screen bg-slate-50 p-4 md:p-10">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h1 className="text-3xl font-semibold text-slate-950 md:text-5xl">
            Cleaning / Housekeeping
          </h1>

          <p className="mt-2 text-slate-500 md:mt-3 md:text-lg">
            Manage turnover cleaning and housekeeping tasks.
          </p>
        </div>

        <button
          onClick={() => {
            window.location.href = "/cleaning/new";
          }}
          className="rounded-xl bg-[#10172a] px-6 py-4 text-white hover:bg-[#18213a]"
        >
          + New Cleaning Task
        </button>
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <select
          value={propertyFilter}
          onChange={(e) => setPropertyFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400"
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
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400"
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
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400"
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
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400"
        />

        <span className="text-sm text-slate-400">to</span>

        <input
          type="date"
          value={endFilter}
          onChange={(e) => setEndFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400"
        />

        <button
          onClick={loadTasks}
          className="ml-auto rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
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
        <div className="mt-10 text-slate-500">
          Loading cleaning tasks...
        </div>
      ) : tasks.length === 0 ? (
        <div className="mt-10 rounded-2xl border bg-white p-10 text-center">
          <h2 className="text-2xl font-semibold text-slate-900">
            No cleaning tasks yet
          </h2>

          <p className="mt-2 text-slate-500">
            Create a cleaning task to start tracking turnover
            and housekeeping work.
          </p>
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
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
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                  >
                    <td className="px-5 py-4 font-medium text-slate-900">
                      {task.property?.title ??
                        "Unknown property"}
                    </td>

                    <td className="px-5 py-4 text-slate-700">
                      {formatDate(task.scheduled_date)}
                    </td>

                    <td className="px-5 py-4 text-slate-700">
                      {task.reservation ? (
                        <>
                          <p>
                            {task.reservation
                              .booking_reference ??
                              "—"}
                          </p>
                          {guestName && (
                            <p className="text-xs text-slate-400">
                              {guestName}
                            </p>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-400">
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

                    <td className="px-5 py-4 text-slate-700">
                      {task.assigned_to ?? (
                        <span className="text-slate-400">
                          Unassigned
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4 text-xs text-slate-500">
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
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          View
                        </button>

                        <button
                          onClick={() =>
                            (window.location.href = `/cleaning/${task.id}/edit`)
                          }
                          className="rounded-lg bg-[#10172a] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#18213a]"
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
    </main>
  );
}
