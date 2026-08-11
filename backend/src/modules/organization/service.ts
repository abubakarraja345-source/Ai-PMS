import {
  findMembersByOrganization,
  findMemberById,
  findMembershipByUserId,
  findOrganizationBySlug,
  insertOrganization,
  insertMembership,
  deleteOrganizationById,
  updateMemberRole,
  deleteMember,
} from "./repository";

import { OrganizationMember } from "./types";
import { CreateOrganizationInput, validateCreateOrganization } from "./validation";
import { supabase } from "../../config/supabase";
import { isOrganizationRole } from "../../middleware/organization.middleware";

import {
  notifyMemberRemoved,
  notifyMemberRoleChanged,
} from "../notifications/service";

const ALREADY_HAS_ORGANIZATION_MESSAGE =
  "You already belong to an organization";

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return base || "workspace";
}

/**
 * Appends a short random suffix on collision rather than an
 * incrementing counter — avoids an extra COUNT query and is
 * sufficiently unique for a field that only needs to avoid
 * accidental collisions between similarly-named organizations, not
 * cryptographic uniqueness.
 */
async function generateUniqueSlug(name: string): Promise<string> {
  const base = slugify(name);

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate =
      attempt === 0
        ? base
        : `${base}-${Math.random().toString(36).slice(2, 7)}`;

    const existing = await findOrganizationBySlug(candidate);

    if (!existing) {
      return candidate;
    }
  }

  return `${base}-${Date.now()}`;
}

/**
 * Onboarding's "Create Workspace" action.
 *
 * KNOWN LIMITATION (confirmed by live testing, not just theorized):
 * there is no stored procedure/RPC in this schema and no unique
 * constraint on organization_members.user_id, and the Supabase JS
 * client (used everywhere else in this codebase) has no multi-
 * statement transaction primitive across two tables through
 * PostgREST — adding either would mean a schema migration, which
 * requires explicit approval and was not made in this phase.
 *
 * This function uses check-then-act with a second re-check
 * immediately before the membership insert, plus a compensating
 * delete of the organization if anything after its creation fails.
 * That fully closes a *sequential* double-submit (confirmed: a
 * second request after the first completes correctly gets 409). It
 * does NOT close a genuinely *concurrent* double-submit — two
 * requests arriving together can both pass the pre-check before
 * either has inserted anything, and both succeed, leaving the user
 * with two organizations and two membership rows (confirmed by a
 * live concurrent test, not just a theoretical race). The frontend
 * onboarding form disables its submit button while a request is in
 * flight, which prevents this via normal UI use (a click, or a page
 * refresh, cannot fire two overlapping requests) — this gap is only
 * reachable by a client that deliberately fires simultaneous raw API
 * requests. Closing it properly needs a database-level unique
 * constraint on organization_members.user_id (recommended) or a
 * transactional RPC function; either is a schema change outside this
 * phase's approval and is flagged in the final report instead of
 * being added unilaterally.
 */
export async function createOrganization(
  userId: string,
  rawInput: unknown
) {
  const input: CreateOrganizationInput =
    validateCreateOrganization(rawInput);

  const existingMembership = await findMembershipByUserId(userId);

  if (existingMembership) {
    throw new Error(ALREADY_HAS_ORGANIZATION_MESSAGE);
  }

  const slug = await generateUniqueSlug(input.name);

  const organization = await insertOrganization({
    name: input.name,
    slug,
    country: input.country,
    timezone: input.timezone,
  });

  const raceCheck = await findMembershipByUserId(userId);

  if (raceCheck) {
    await deleteOrganizationById(organization.id).catch((cleanupError) => {
      console.error(
        "Failed to roll back orphaned organization after a race-losing create:",
        cleanupError
      );
    });

    throw new Error(ALREADY_HAS_ORGANIZATION_MESSAGE);
  }

  try {
    await insertMembership(organization.id, userId, "owner");
  } catch (membershipError) {
    await deleteOrganizationById(organization.id).catch((cleanupError) => {
      console.error(
        "Failed to roll back organization after a failed membership insert:",
        cleanupError
      );
    });

    throw membershipError;
  }

  return organization;
}

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

  const updated = await updateMemberRole(
    organizationId,
    targetMemberId,
    newRole
  );

  if (updated) {
    await notifyMemberRoleChanged(
      organizationId,
      target.user_id,
      newRole
    );
  }

  return updated;
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

  const deleted = await deleteMember(organizationId, targetMemberId);

  if (deleted) {
    await notifyMemberRemoved(organizationId, target.user_id);
  }

  return deleted;
}
