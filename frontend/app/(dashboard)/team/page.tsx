"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { usePermission } from "@/lib/permission-context";
import ConfirmDialog from "@/components/shared/confirm-dialog";

type OrganizationRole =
  | "owner"
  | "company_admin"
  | "manager"
  | "host"
  | "member"
  | "spectator";
type InvitableRole = Exclude<OrganizationRole, "owner">;

interface Member {
  id: string;
  userId: string;
  email: string | null;
  role: OrganizationRole;
  createdAt: string;
}

interface RoleEffectivePermissions {
  permissions: string[];
  permissionEffects: Record<string, "allow" | "deny" | "approval">;
}

const ASSIGNABLE_ROLES: OrganizationRole[] = [
  "company_admin",
  "manager",
  "host",
  "member",
  "spectator",
];

const INVITABLE_ROLES: InvitableRole[] = [
  "member",
  "manager",
  "host",
  "spectator",
  "company_admin",
];

function getRoleClasses(role: OrganizationRole) {
  switch (role) {
    case "owner":
      return "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30";
    case "company_admin":
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30";
    case "manager":
      return "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30";
    case "host":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30";
    case "spectator":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-muted text-foreground/70 border-border";
  }
}

const ROLE_LABEL_FALLBACK: Record<OrganizationRole, string> = {
  owner: "Owner",
  company_admin: "Admin",
  manager: "Manager",
  host: "Host",
  member: "Member",
  spectator: "Spectator",
};

function humanizeAction(action: string) {
  const [resource, ...rest] = action.split(".");
  return `${resource} — ${rest.join(" ").replace(/_/g, " ")}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function TeamPage() {
  const { can, roleLabel: selfRoleLabel } = usePermission();

  const [members, setMembers] = useState<Member[]>([]);
  const [selfUserId, setSelfUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [success, setSuccess] = useState("");

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InvitableRole>("member");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");

  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);

  // Phase 7.5
  const [roleLabels, setRoleLabels] = useState<Record<string, string>>(ROLE_LABEL_FALLBACK);
  const [roleMatrix, setRoleMatrix] = useState<Record<string, RoleEffectivePermissions>>({});
  const [assignmentsByUser, setAssignmentsByUser] = useState<Record<string, string[]>>({});
  const [pendingApprovalsByUser, setPendingApprovalsByUser] = useState<Record<string, number>>({});
  const [roleChangeTarget, setRoleChangeTarget] = useState<{
    member: Member;
    newRole: OrganizationRole;
  } | null>(null);

  const canManageTeam = can("team.invite");
  const canChangeRoles = can("team.manage_roles");
  const canRemoveMembers = can("team.remove");

  const loadMembers = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setSelfUserId(session?.user?.id ?? null);

      const response = await apiFetch("/api/organization/members");

      setMembers(response.data ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load team members."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRoleMatrix = useCallback(async () => {
    try {
      const response = await apiFetch("/api/organization/role-matrix");
      setRoleLabels(response.data?.roleLabels ?? ROLE_LABEL_FALLBACK);
      setRoleMatrix(response.data?.matrix ?? {});
    } catch {
      // Non-fatal — the "Change Role" preview just won't show gained/
      // lost detail; the change itself still works via the backend's
      // own enforcement regardless.
    }
  }, []);

  const loadAssignments = useCallback(async () => {
    try {
      const response = await apiFetch("/api/organization/property-assignments");
      const byUser: Record<string, string[]> = {};
      for (const row of response.data ?? []) {
        (byUser[row.userId] ??= []).push(row.propertyTitle);
      }
      setAssignmentsByUser(byUser);
    } catch {
      setAssignmentsByUser({});
    }
  }, []);

  const loadPendingApprovals = useCallback(async () => {
    try {
      const response = await apiFetch("/api/approvals?status=pending");
      const byUser: Record<string, number> = {};
      for (const request of response.data ?? []) {
        byUser[request.requestedBy] = (byUser[request.requestedBy] ?? 0) + 1;
      }
      setPendingApprovalsByUser(byUser);
    } catch {
      setPendingApprovalsByUser({});
    }
  }, []);

  useEffect(() => {
    loadMembers();
    loadRoleMatrix();
    loadAssignments();
    loadPendingApprovals();
  }, [loadMembers, loadRoleMatrix, loadAssignments, loadPendingApprovals]);

  async function sendInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!inviteEmail.trim()) {
      setInviteError("Please enter an email address.");
      return;
    }

    try {
      setInviting(true);
      setInviteError("");

      const response = await apiFetch("/api/organization/invitations", {
        method: "POST",
        body: JSON.stringify({
          email: inviteEmail.trim(),
          full_name: inviteFullName.trim() || undefined,
          role: inviteRole,
        }),
      });

      setShowInviteModal(false);
      setInviteFullName("");
      setInviteEmail("");
      setInviteRole("member");

      const addedEmail = inviteEmail.trim();
      setSuccess(
        response.data?.accountProvisioned
          ? `${addedEmail} was added and emailed their login details.`
          : `${addedEmail} was added to the team.`
      );

      await loadMembers();
      await loadAssignments();
    } catch (err) {
      setInviteError(
        err instanceof Error ? err.message : "Failed to add team member."
      );
    } finally {
      setInviting(false);
    }
  }

  async function applyRoleChange() {
    if (!roleChangeTarget) return;

    const { member, newRole } = roleChangeTarget;

    try {
      setSavingId(member.id);
      setError("");
      setRoleChangeTarget(null);

      await apiFetch(`/api/organization/members/${member.id}`, {
        method: "PATCH",
        body: JSON.stringify({ role: newRole }),
      });

      setSuccess(`${member.email ?? "Member"}'s role changed to ${roleLabels[newRole] ?? newRole}.`);
      await loadMembers();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update member role."
      );
    } finally {
      setSavingId(null);
    }
  }

  async function handleRemoveConfirmed() {
    if (!removeTarget) return;

    try {
      setRemovingId(removeTarget.id);
      setError("");

      await apiFetch(`/api/organization/members/${removeTarget.id}`, {
        method: "DELETE",
      });

      setMembers((current) =>
        current.filter((member) => member.id !== removeTarget.id)
      );
      setRemoveTarget(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to remove member."
      );
      setRemoveTarget(null);
    } finally {
      setRemovingId(null);
    }
  }

  function formatRole(role: string) {
    return roleLabels[role] ?? ROLE_LABEL_FALLBACK[role as OrganizationRole] ?? role;
  }

  const self = members.find((member) => member.userId === selfUserId);

  const gainedLost = (() => {
    if (!roleChangeTarget) return null;
    const current = roleMatrix[roleChangeTarget.member.role]?.permissions ?? [];
    const next = roleMatrix[roleChangeTarget.newRole]?.permissions ?? [];
    const gained = next.filter((a) => !current.includes(a));
    const lost = current.filter((a) => !next.includes(a));
    return { gained, lost };
  })();

  return (
    <main className="min-h-screen bg-background p-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-5xl font-semibold text-foreground">
            Team
          </h1>

          <p className="mt-3 text-lg text-muted-foreground">
            View your organization&apos;s members and manage their
            roles.
            {selfRoleLabel && (
              <span className="ml-2 text-sm text-muted-foreground/80">
                You are signed in as {selfRoleLabel}.
              </span>
            )}
          </p>
        </div>

        {canManageTeam && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-4 text-white shadow-lg shadow-indigo-950/20 hover:opacity-90"
          >
            + Add Team Member
          </button>
        )}
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      {success && (
        <div className="mt-6 rounded-xl border border-success/30 bg-success/10 p-4 text-success">
          {success}
        </div>
      )}

      {loading ? (
        <div className="mt-10 text-muted-foreground">
          Loading team members...
        </div>
      ) : members.length === 0 ? (
        <div className="mt-10 glass-panel rounded-2xl p-10 text-center">
          <h2 className="text-2xl font-semibold text-foreground">
            No members found
          </h2>
        </div>
      ) : (
        <div className="mt-10 overflow-x-auto rounded-2xl solid-panel shadow-sm">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-6 py-4 font-medium text-muted-foreground">
                  Member
                </th>
                <th className="px-6 py-4 font-medium text-muted-foreground">
                  Role
                </th>
                <th className="px-6 py-4 font-medium text-muted-foreground">
                  Assigned Properties
                </th>
                <th className="px-6 py-4 font-medium text-muted-foreground">
                  Joined
                </th>
                {(canChangeRoles || canRemoveMembers) && (
                  <th className="px-6 py-4 font-medium text-muted-foreground">
                    Actions
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              {members.map((member) => {
                const isSelf = member.userId === selfUserId;
                const isOwner = member.role === "owner";
                const busy =
                  savingId === member.id || removingId === member.id;

                const disabledReason = isOwner
                  ? "The organization owner cannot be changed"
                  : isSelf
                  ? "You cannot change your own role"
                  : !canChangeRoles
                  ? "You don't have permission to perform this action."
                  : undefined;

                const removeDisabledReason = isOwner
                  ? "The organization owner cannot be removed"
                  : isSelf
                  ? "You cannot remove yourself"
                  : !canRemoveMembers
                  ? "You don't have permission to perform this action."
                  : undefined;

                const assignedProperties = assignmentsByUser[member.userId] ?? [];
                const pendingCount = pendingApprovalsByUser[member.userId] ?? 0;

                return (
                  <tr
                    key={member.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="max-w-[240px] px-6 py-4">
                      <p className="truncate font-medium text-foreground">
                        {member.email ?? "Unknown email"}
                        {isSelf && (
                          <span className="ml-2 text-xs font-normal text-muted-foreground/80">
                            (you)
                          </span>
                        )}
                      </p>
                      {pendingCount > 0 && (
                        <Link
                          href="/approvals"
                          className="mt-1 inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/20"
                        >
                          {pendingCount} pending approval{pendingCount === 1 ? "" : "s"}
                        </Link>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${getRoleClasses(
                          member.role
                        )}`}
                      >
                        {formatRole(member.role)}
                      </span>
                    </td>

                    <td className="max-w-[220px] px-6 py-4 text-foreground/70">
                      {["manager", "host", "spectator"].includes(member.role) ? (
                        assignedProperties.length > 0 ? (
                          <span className="truncate" title={assignedProperties.join(", ")}>
                            {assignedProperties.join(", ")}
                          </span>
                        ) : (
                          <span className="text-xs text-warning">None assigned</span>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground/80">All properties</span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-muted-foreground">
                      {formatDate(member.createdAt)}
                    </td>

                    {(canChangeRoles || canRemoveMembers) && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/audit-log?entity_type=member&entity_id=${member.id}`}
                            className="text-sm font-medium text-muted-foreground hover:text-foreground"
                          >
                            Activity
                          </Link>

                          {canChangeRoles && (
                            <select
                              value={
                                ASSIGNABLE_ROLES.includes(member.role)
                                  ? member.role
                                  : ""
                              }
                              disabled={Boolean(disabledReason) || busy}
                              title={disabledReason}
                              onChange={(event) => {
                                const newRole = event.target.value as OrganizationRole;
                                if (newRole === member.role) return;
                                setRoleChangeTarget({ member, newRole });
                              }}
                              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground/80 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {!ASSIGNABLE_ROLES.includes(member.role) && (
                                <option value="">
                                  {formatRole(member.role)}
                                </option>
                              )}
                              {ASSIGNABLE_ROLES.map((role) => (
                                <option key={role} value={role}>
                                  {formatRole(role)}
                                </option>
                              ))}
                            </select>
                          )}

                          {canRemoveMembers && (
                            <button
                              onClick={() => setRemoveTarget(member)}
                              disabled={
                                Boolean(removeDisabledReason) || busy
                              }
                              title={removeDisabledReason}
                              className="rounded-lg border border-destructive/30 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {removingId === member.id
                                ? "Removing..."
                                : "Remove"}
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-foreground">
              Add Team Member
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              They&apos;ll get immediate access — if this is a new email, we
              generate a password and email it to them.
            </p>

            <form onSubmit={sendInvitation} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="invite-full-name"
                  className="mb-2 block text-sm font-medium text-foreground/80"
                >
                  Full Name
                </label>

                <input
                  id="invite-full-name"
                  type="text"
                  value={inviteFullName}
                  onChange={(e) => setInviteFullName(e.target.value)}
                  placeholder="Jane Doe"
                  className="w-full rounded-lg border border-border bg-background px-4 py-3 outline-none focus:border-primary"
                />
              </div>

              <div>
                <label
                  htmlFor="invite-email"
                  className="mb-2 block text-sm font-medium text-foreground/80"
                >
                  Email
                </label>

                <input
                  id="invite-email"
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="teammate@example.com"
                  className="w-full rounded-lg border border-border bg-background px-4 py-3 outline-none focus:border-primary"
                />
              </div>

              <div>
                <label
                  htmlFor="invite-role"
                  className="mb-2 block text-sm font-medium text-foreground/80"
                >
                  Role
                </label>

                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) =>
                    setInviteRole(e.target.value as InvitableRole)
                  }
                  className="w-full rounded-lg border border-border bg-background px-4 py-3 outline-none focus:border-primary"
                >
                  {INVITABLE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {formatRole(role)}
                    </option>
                  ))}
                </select>
              </div>

              {inviteError && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {inviteError}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (inviting) return;
                    setShowInviteModal(false);
                    setInviteError("");
                  }}
                  className="rounded-lg border border-border px-5 py-2.5 text-foreground/80 hover:bg-muted"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={inviting}
                  className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {inviting ? "Adding..." : "Add Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!removeTarget}
        title="Remove team member?"
        tone="warning"
        confirmLabel={removingId ? "Removing..." : "Remove"}
        description={
          <>
            Are you sure you want to remove{" "}
            <strong>{removeTarget?.email ?? "this member"}</strong> from this
            organization? This action cannot be undone.
          </>
        }
        onConfirm={handleRemoveConfirmed}
        onCancel={() => setRemoveTarget(null)}
      />

      {/* Phase 7.5 — Change Role preview: shows exactly what's gained/
          lost, computed from the same effective-permissions data the
          backend itself enforces (see role-matrix endpoint), so this
          can never promise something the backend doesn't actually do. */}
      <ConfirmDialog
        open={!!roleChangeTarget}
        title="Change role?"
        tone="warning"
        confirmLabel={savingId ? "Saving..." : "Change Role"}
        description={
          roleChangeTarget && (
            <div>
              <p>
                Changing <strong>{roleChangeTarget.member.email}</strong> from{" "}
                <strong>{formatRole(roleChangeTarget.member.role)}</strong> to{" "}
                <strong>{formatRole(roleChangeTarget.newRole)}</strong>.
              </p>

              {gainedLost && (gainedLost.gained.length > 0 || gainedLost.lost.length > 0) && (
                <div className="mt-3 max-h-64 space-y-3 overflow-y-auto rounded-lg border border-border bg-muted p-3">
                  {gainedLost.gained.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-success">
                        Gains
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {gainedLost.gained.map((a) => (
                          <li key={a} className="text-xs text-success">
                            + {humanizeAction(a)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {gainedLost.lost.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-destructive">
                        Loses
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {gainedLost.lost.map((a) => (
                          <li key={a} className="text-xs text-destructive">
                            − {humanizeAction(a)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        }
        onConfirm={applyRoleChange}
        onCancel={() => setRoleChangeTarget(null)}
      />
    </main>
  );
}
