"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { PaginationControls } from "@/components/shared/pagination-controls";

interface PropertyOption {
  id: string;
  title: string;
}

interface MaintenanceTicket {
  id: string;
  property_id: string;
  reservation_id: string | null;
  status: string;
  priority: string;
  category: string | null;
  title: string;
  assigned_to: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  created_at: string;
  property?: PropertyOption | null;
  reservation?: {
    id: string;
    booking_reference: string | null;
  } | null;
}

function getStatusClasses(status: string) {
  switch (status) {
    case "open":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "in_progress":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "resolved":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "closed":
      return "bg-muted text-foreground/70 border-border";
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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function MaintenancePage() {
  const [tickets, setTickets] = useState<MaintenanceTicket[]>(
    []
  );
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
  const [categoryFilter, setCategoryFilter] = useState("");
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
    categoryFilter,
    assignedToFilter,
  ]);

  const loadTickets = useCallback(async () => {
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
      if (categoryFilter.trim())
        params.set("category", categoryFilter.trim());
      if (assignedToFilter.trim())
        params.set("assigned_to", assignedToFilter.trim());
      params.set("page", String(page));

      const query = params.toString();

      const response = await apiFetch(
        `/api/maintenance${query ? `?${query}` : ""}`
      );

      setTickets(response.data ?? []);
      setTotalPages(response.meta?.totalPages ?? 1);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load maintenance tickets"
      );
    } finally {
      setLoading(false);
    }
  }, [
    propertyFilter,
    statusFilter,
    priorityFilter,
    categoryFilter,
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
    loadTickets();
  }, [loadTickets]);

  async function deleteTicket(ticketId: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this maintenance ticket?\n\nThis action cannot be undone."
    );

    if (!confirmed) return;

    try {
      setDeletingId(ticketId);
      setError("");

      await apiFetch(`/api/maintenance/${ticketId}`, {
        method: "DELETE",
      });

      setTickets((current) =>
        current.filter((t) => t.id !== ticketId)
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete maintenance ticket"
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
            Maintenance
          </h1>

          <p className="mt-2 text-muted-foreground md:mt-3 md:text-lg">
            Track and resolve property maintenance issues.
          </p>
        </div>

        <button
          onClick={() => {
            window.location.href = "/maintenance/new";
          }}
          className="rounded-xl bg-gradient-to-r from-primary to-accent px-6 py-4 text-white hover:opacity-90"
        >
          + New Ticket
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
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground/80 outline-none focus:border-primary"
        >
          <option value="all">All priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>

        <input
          type="text"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          placeholder="Filter by category..."
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
          onClick={loadTickets}
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
          Loading maintenance tickets...
        </div>
      ) : tickets.length === 0 ? (
        <div className="mt-10 rounded-2xl border bg-card p-10 text-center">
          <h2 className="text-2xl font-semibold text-foreground">
            No maintenance tickets yet
          </h2>

          <p className="mt-2 text-muted-foreground">
            Create a ticket to start tracking a property
            issue.
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
                  Title
                </th>
                <th className="px-5 py-3 font-medium">
                  Category
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
                  Reservation
                </th>
                <th className="px-5 py-3 font-medium">
                  Created
                </th>
                <th className="px-5 py-3 font-medium">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {tickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  className="border-b border-border/60 last:border-0 hover:bg-muted/60"
                >
                  <td className="px-5 py-4 font-medium text-foreground">
                    {ticket.property?.title ??
                      "Unknown property"}
                  </td>

                  <td className="px-5 py-4 text-foreground/80">
                    {ticket.title}
                  </td>

                  <td className="px-5 py-4 text-muted-foreground">
                    {ticket.category ?? "—"}
                  </td>

                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${getPriorityClasses(
                        ticket.priority
                      )}`}
                    >
                      {ticket.priority}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${getStatusClasses(
                        ticket.status
                      )}`}
                    >
                      {ticket.status.replace("_", " ")}
                    </span>
                  </td>

                  <td className="px-5 py-4 text-foreground/80">
                    {ticket.assigned_to ?? (
                      <span className="text-muted-foreground/80">
                        Unassigned
                      </span>
                    )}
                  </td>

                  <td className="px-5 py-4 text-foreground/80">
                    {ticket.reservation
                      ? ticket.reservation
                          .booking_reference ??
                        "Linked"
                      : "—"}
                  </td>

                  <td className="px-5 py-4 text-muted-foreground">
                    {formatDate(ticket.created_at)}
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          (window.location.href = `/maintenance/${ticket.id}`)
                        }
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-muted"
                      >
                        View
                      </button>

                      <button
                        onClick={() =>
                          (window.location.href = `/maintenance/${ticket.id}/edit`)
                        }
                        className="rounded-lg bg-gradient-to-r from-primary to-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() =>
                          deleteTicket(ticket.id)
                        }
                        disabled={
                          deletingId === ticket.id
                        }
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingId === ticket.id
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
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
