"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface Assignment {
  userId: string;
  email: string | null;
  role: string;
}

interface Member {
  userId: string;
  email: string | null;
  role: string;
}

/**
 * Phase 7.4 — property-level access management. Self-contained (own
 * fetch/save cycle, own permission check via /me's permissions array)
 * rather than relying on the parent page's canManage, since that only
 * ever covered owner/company_admin — team.assign_properties is also
 * granted to manager (see permissions/matrix.ts).
 */
export default function PropertyAssignmentsSection({ propertyId }: { propertyId: string }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [adding, setAdding] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setError("");

      const [meRes, assignmentsRes, membersRes] = await Promise.all([
        apiFetch("/api/organization/me"),
        apiFetch(`/api/properties/${propertyId}/assignments`),
        apiFetch("/api/organization/members"),
      ]);

      setCanManage((meRes.data?.permissions ?? []).includes("team.assign_properties"));
      setAssignments(assignmentsRes.data ?? []);
      setMembers(
        (membersRes.data ?? []).map((m: { userId: string; email: string | null; role: string }) => ({
          userId: m.userId,
          email: m.email,
          role: m.role,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load assignments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (propertyId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  // Only Manager/Host/Spectator are ever property-scope-restricted
  // (see permissions/propertyScope.ts) — Owner/Admin always see every
  // property regardless of assignment, so assigning them here would
  // do nothing.
  const assignableMembers = members.filter(
    (m) =>
      ["manager", "host", "spectator"].includes(m.role) &&
      !assignments.some((a) => a.userId === m.userId)
  );

  async function handleAdd() {
    if (!selectedUserId) return;

    try {
      setAdding(true);
      setError("");
      await apiFetch(`/api/properties/${propertyId}/assignments`, {
        method: "POST",
        body: JSON.stringify({ userId: selectedUserId }),
      });
      setSelectedUserId("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign.");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(userId: string) {
    try {
      setError("");
      await apiFetch(`/api/properties/${propertyId}/assignments/${userId}`, {
        method: "DELETE",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove assignment.");
    }
  }

  if (loading) {
    return (
      <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-foreground">Assigned Team Members</h2>
        <p className="mt-3 text-sm text-muted-foreground/80">Loading...</p>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-foreground">Assigned Team Members</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Manager, Host, and Spectator roles only see properties they&apos;re
        assigned to here. Owner and Admin always see every property.
      </p>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {assignments.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground/80">No one is specifically assigned yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {assignments.map((a) => (
            <li
              key={a.userId}
              className="flex items-center justify-between rounded-xl border border-border bg-muted px-4 py-2.5"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{a.email ?? a.userId}</p>
                <p className="text-xs capitalize text-muted-foreground">{a.role}</p>
              </div>
              {canManage && (
                <button
                  onClick={() => handleRemove(a.userId)}
                  className="text-xs font-medium text-red-600 hover:text-red-700"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="">Assign a team member...</option>
            {assignableMembers.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.email ?? m.userId} ({m.role})
              </option>
            ))}
          </select>
          <button
            onClick={handleAdd}
            disabled={!selectedUserId || adding}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {adding ? "Assigning..." : "Assign"}
          </button>
          {assignableMembers.length === 0 && (
            <p className="text-xs text-muted-foreground/80">
              No Manager/Host/Spectator members available to assign.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
