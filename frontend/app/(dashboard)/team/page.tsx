"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

type OrganizationRole = "owner" | "company_admin" | "member";

interface Member {
  id: string;
  userId: string;
  email: string | null;
  role: OrganizationRole;
  createdAt: string;
}

const ASSIGNABLE_ROLES: OrganizationRole[] = [
  "company_admin",
  "member",
];

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

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

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
      <div>
        <h1 className="text-5xl font-semibold text-slate-950">
          Team
        </h1>

        <p className="mt-3 text-lg text-slate-500">
          View your organization&apos;s members and manage their
          roles.
        </p>
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
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
    </main>
  );
}
