import {
  findMembersByOrganization,
  findMemberById,
  updateMemberRole,
  deleteMember,
} from "./repository";

import { OrganizationMember } from "./types";
import { supabase } from "../../config/supabase";
import { isOrganizationRole } from "../../middleware/organization.middleware";

/**
 * organization_members only stores user_id — resolving a
 * human-readable email requires the Supabase Auth admin API.
 * Run in parallel; a lookup failure for one user degrades to a
 * null email for that row rather than failing the whole list.
 */
async function resolveEmail(
  userId: string
): Promise<string | null> {
  try {
    const { data, error } =
      await supabase.auth.admin.getUserById(userId);

    if (error || !data?.user) {
      return null;
    }

    return data.user.email ?? null;
  } catch {
    return null;
  }
}

export async function listMembers(
  organizationId: string
): Promise<OrganizationMember[]> {
  const members = await findMembersByOrganization(
    organizationId
  );

  const emailEntries = await Promise.all(
    members.map(
      async (m) =>
        [m.user_id, await resolveEmail(m.user_id)] as const
    )
  );

  const emailByUserId = new Map(emailEntries);

  return members.map((member) => ({
    id: member.id,
    userId: member.user_id,
    email: emailByUserId.get(member.user_id) ?? null,
    role: isOrganizationRole(member.role)
      ? member.role
      : "member",
    createdAt: member.created_at,
  }));
}

/**
 * Changing a member's role. Enforces, in order:
 * - the target membership must exist and belong to the
 *   caller's organization (never trusted from the client)
 * - nobody can change their own role (blocks both "members
 *   cannot elevate their own role" and "company admins cannot
 *   promote themselves" with a single, simpler, safe rule: no
 *   self-role-changes at all, regardless of direction)
 * - the owner's role can never be changed by anyone
 * - the new role can never be "owner" (ownership transfer is
 *   explicitly out of scope) — already enforced by
 *   validateChangeRole's allowlist, re-checked here defensively
 *
 * Coarse "is the caller an owner or company_admin at all" is
 * enforced by the requireRole middleware before this ever runs
 * — a plain "member" caller never reaches this function.
 */
export async function changeMemberRole(
  organizationId: string,
  callerUserId: string,
  targetMemberId: string,
  newRole: string
) {
  const target = await findMemberById(
    organizationId,
    targetMemberId
  );

  if (!target) {
    return null;
  }

  if (target.user_id === callerUserId) {
    throw new Error("You cannot change your own role");
  }

  if (target.role === "owner") {
    throw new Error(
      "The organization owner's role cannot be changed"
    );
  }

  if (newRole === "owner") {
    throw new Error(
      "Ownership cannot be transferred through this action"
    );
  }

  return updateMemberRole(
    organizationId,
    targetMemberId,
    newRole
  );
}

/**
 * Removing a member. Enforces:
 * - the target membership must exist and belong to the
 *   caller's organization
 * - nobody can remove themselves through this action (not
 *   requested as a feature — "leaving" an organization is a
 *   distinct, unaddressed flow; blocking it here avoids an org
 *   accidentally losing its only owner/admin)
 * - the owner can never be removed, by anyone
 *
 * Coarse role gating (owner/company_admin only) is enforced by
 * requireRole before this runs.
 */
export async function removeMember(
  organizationId: string,
  callerUserId: string,
  targetMemberId: string
) {
  const target = await findMemberById(
    organizationId,
    targetMemberId
  );

  if (!target) {
    return false;
  }

  if (target.user_id === callerUserId) {
    throw new Error(
      "You cannot remove yourself from the organization"
    );
  }

  if (target.role === "owner") {
    throw new Error(
      "The organization owner cannot be removed"
    );
  }

  return deleteMember(organizationId, targetMemberId);
}
