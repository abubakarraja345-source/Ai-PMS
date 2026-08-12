"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

type OrganizationRole = "owner" | "company_admin" | "member";
type InvitableRole = "company_admin" | "member";
type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

interface Member {
  id: string;
  userId: string;
  email: string | null;
  role: OrganizationRole;
  createdAt: string;
}

interface Invitation {
  id: string;
  email: string;
  fullName: string | null;
  role: InvitableRole;
  status: InvitationStatus;
  expiresAt: string;
  invitedBy: string;
  createdAt: string;
  acceptedAt: string | null;
}

const ASSIGNABLE_ROLES: OrganizationRole[] = [
  "company_admin",
  "member",
];

const INVITABLE_ROLES: InvitableRole[] = ["member", "company_admin"];

function getInvitationStatusClasses(status: InvitationStatus) {
  switch (status) {
    case "pending":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "accepted":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "revoked":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-slate-50 text-slate-500 border-slate-200";
  }
}

function getRoleClasses(role: OrganizationRole) {
  switch (role) {
    case "owner":
      return "bg-violet-50 text-violet-700 border-violet-200";
    case "company_admin":
      return "bg-blue-50 text-blue-700 border-blue-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

function formatRole(role: OrganizationRole) {
  if (role === "company_admin") return "Company Admin";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [selfUserId, setSelfUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [success, setSuccess] = useState("");

  const [invitations, setInvitations] = useState<Invitation[]>([]);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InvitableRole>("member");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");

  const [resendingId, setResendingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

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

  const loadInvitations = useCallback(async () => {
    try {
      const response = await apiFetch("/api/organization/invitations");
      setInvitations(response.data ?? []);
    } catch {
      // Expected (403) for the "member" role, which the backend
      // correctly never allows to list invitations — the section
      // simply doesn't render for them (see canManage below), so this
      // is not a page-level error.
      setInvitations([]);
    }
  }, []);

  useEffect(() => {
    loadMembers();
    loadInvitations();
  }, [loadMembers, loadInvitations]);

  async function sendInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!inviteEmail.trim()) {
      setInviteError("Please enter an email address.");
      return;
    }

    try {
      setInviting(true);
      setInviteError("");

      await apiFetch("/api/organization/invitations", {
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
      setSuccess(`Invitation sent to ${inviteEmail.trim()}.`);
      await loadInvitations();
    } catch (err) {
      setInviteError(
        err instanceof Error ? err.message : "Failed to send invitation."
      );
    } finally {
      setInviting(false);
    }
  }

  async function resendInvitation(invitationId: string, email: string) {
    try {
      setResendingId(invitationId);
      setError("");

      await apiFetch(`/api/organization/invitations/${invitationId}/resend`, {
        method: "POST",
      });

      setSuccess(`Invitation resent to ${email}.`);
      await loadInvitations();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to resend invitation."
      );
    } finally {
      setResendingId(null);
    }
  }

  async function revokeInvitation(invitationId: string, email: string) {
    const confirmed = window.confirm(
      `Revoke the invitation to ${email}?\n\nThe invitation link will stop working.`
    );

    if (!confirmed) return;

    try {
      setRevokingId(invitationId);
      setError("");

      await apiFetch(`/api/organization/invitations/${invitationId}/revoke`, {
        method: "POST",
      });

      setSuccess(`Invitation to ${email} revoked.`);
      await loadInvitations();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to revoke invitation."
      );
    } finally {
      setRevokingId(null);
    }
  }

  async function changeRole(memberId: string, role: OrganizationRole) {
    try {
      setSavingId(memberId);
      setError("");

      await apiFetch(`/api/organization/members/${memberId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });

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

  async function removeMember(memberId: string, label: string) {
    const confirmed = window.confirm(
      `Are you sure you want to remove ${label} from this organization?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setRemovingId(memberId);
      setError("");

      await apiFetch(`/api/organization/members/${memberId}`, {
        method: "DELETE",
      });

      setMembers((current) =>
        current.filter((member) => member.id !== memberId)
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to remove member."
      );
    } finally {
      setRemovingId(null);
    }
  }

  const self = members.find((member) => member.userId === selfUserId);
  const canManage =
    self?.role === "owner" || self?.role === "company_admin";

  return (
    <main className="min-h-screen bg-slate-50 p-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-5xl font-semibold text-slate-950">
            Team
          </h1>

          <p className="mt-3 text-lg text-slate-500">
            View your organization&apos;s members and manage their
            roles.
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="rounded-xl bg-[#10172a] px-6 py-4 text-white hover:bg-[#18213a]"
          >
            + Invite Member
          </button>
        )}
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
          {success}
        </div>
      )}

      {loading ? (
        <div className="mt-10 text-slate-500">
          Loading team members...
        </div>
      ) : members.length === 0 ? (
        <div className="mt-10 rounded-2xl border bg-white p-10 text-center">
          <h2 className="text-2xl font-semibold text-slate-900">
            No members found
          </h2>
        </div>
      ) : (
        <div className="mt-10 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-6 py-4 font-medium text-slate-500">
                  Member
                </th>
                <th className="px-6 py-4 font-medium text-slate-500">
                  Role
                </th>
                <th className="px-6 py-4 font-medium text-slate-500">
                  Joined
                </th>
                {canManage && (
                  <th className="px-6 py-4 font-medium text-slate-500">
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
                  : undefined;

                const removeDisabledReason = isOwner
                  ? "The organization owner cannot be removed"
                  : isSelf
                  ? "You cannot remove yourself"
                  : undefined;

                return (
                  <tr
                    key={member.id}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="max-w-[260px] px-6 py-4">
                      <p className="truncate font-medium text-slate-900">
                        {member.email ?? "Unknown email"}
                        {isSelf && (
                          <span className="ml-2 text-xs font-normal text-slate-400">
                            (you)
                          </span>
                        )}
                      </p>
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

                    <td className="px-6 py-4 text-slate-500">
                      {formatDate(member.createdAt)}
                    </td>

                    {canManage && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/audit-log?entity_type=member&entity_id=${member.id}`}
                            className="text-sm font-medium text-slate-500 hover:text-slate-900"
                          >
                            Activity
                          </Link>

                          <select
                            value={
                              ASSIGNABLE_ROLES.includes(member.role)
                                ? member.role
                                : ""
                            }
                            disabled={Boolean(disabledReason) || busy}
                            title={disabledReason}
                            onChange={(event) =>
                              changeRole(
                                member.id,
                                event.target.value as OrganizationRole
                              )
                            }
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
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

                          <button
                            onClick={() =>
                              removeMember(
                                member.id,
                                member.email ?? "this member"
                              )
                            }
                            disabled={
                              Boolean(removeDisabledReason) || busy
                            }
                            title={removeDisabledReason}
                            className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {removingId === member.id
                              ? "Removing..."
                              : "Remove"}
                          </button>
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

      {canManage && invitations.length > 0 && (
        <div className="mt-12">
          <h2 className="text-2xl font-semibold text-slate-950">
            Pending Invitations
          </h2>

          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-6 py-4 font-medium text-slate-500">
                    Email
                  </th>
                  <th className="px-6 py-4 font-medium text-slate-500">
                    Name
                  </th>
                  <th className="px-6 py-4 font-medium text-slate-500">
                    Role
                  </th>
                  <th className="px-6 py-4 font-medium text-slate-500">
                    Status
                  </th>
                  <th className="px-6 py-4 font-medium text-slate-500">
                    Expires
                  </th>
                  <th className="px-6 py-4 font-medium text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {invitations.map((invitation) => {
                  const busy =
                    resendingId === invitation.id ||
                    revokingId === invitation.id;
                  const isPending = invitation.status === "pending";

                  return (
                    <tr
                      key={invitation.id}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="max-w-[220px] truncate px-6 py-4 font-medium text-slate-900">
                        {invitation.email}
                      </td>

                      <td className="px-6 py-4 text-slate-700">
                        {invitation.fullName ?? "—"}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-medium ${getRoleClasses(
                            invitation.role
                          )}`}
                        >
                          {formatRole(invitation.role)}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${getInvitationStatusClasses(
                            invitation.status
                          )}`}
                        >
                          {invitation.status}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-slate-500">
                        {formatDate(invitation.expiresAt)}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() =>
                              resendInvitation(
                                invitation.id,
                                invitation.email
                              )
                            }
                            disabled={!isPending || busy}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {resendingId === invitation.id
                              ? "Resending..."
                              : "Resend"}
                          </button>

                          <button
                            onClick={() =>
                              revokeInvitation(
                                invitation.id,
                                invitation.email
                              )
                            }
                            disabled={!isPending || busy}
                            className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {revokingId === invitation.id
                              ? "Revoking..."
                              : "Revoke"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-slate-950">
              Invite Member
            </h2>

            <form onSubmit={sendInvitation} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="invite-full-name"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Full Name
                </label>

                <input
                  id="invite-full-name"
                  type="text"
                  value={inviteFullName}
                  onChange={(e) => setInviteFullName(e.target.value)}
                  placeholder="Jane Doe"
                  className="w-full rounded-lg border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label
                  htmlFor="invite-email"
                  className="mb-2 block text-sm font-medium text-slate-700"
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
                  className="w-full rounded-lg border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label
                  htmlFor="invite-role"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Role
                </label>

                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) =>
                    setInviteRole(e.target.value as InvitableRole)
                  }
                  className="w-full rounded-lg border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                >
                  {INVITABLE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {formatRole(role)}
                    </option>
                  ))}
                </select>
              </div>

              {inviteError && (
                <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
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
                  className="rounded-lg border border-slate-200 px-5 py-2.5 text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={inviting}
                  className="rounded-lg bg-[#10172a] px-5 py-2.5 text-white hover:bg-[#18213a] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {inviting ? "Sending..." : "Send Invitation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
