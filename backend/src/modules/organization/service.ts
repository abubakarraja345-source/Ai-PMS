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

export const ALREADY_HAS_ORGANIZATION_MESSAGE =
  "You already belong to an organization";

/**
 * Postgres SQLSTATE 23505 (unique_violation). The Supabase JS client
 * surfaces Postgres errors as plain objects with a `.code` field rather
 * than a typed exception class, so this is a structural check rather
 * than an `instanceof`. Exported for reuse by invitations.service.ts,
 * which hits the same constraint via a different code path (accepting
 * an invitation also inserts an organization_members row).
 */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

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
 * The application-level check-then-act below (pre-check, re-check
 * immediately before the membership insert, compensating delete of the
 * organization if a later step fails) fully handles the *sequential*
 * double-submit case on its own and gives it a fast, friendly 409
 * without ever reaching the database constraint. It does NOT by itself
 * close a genuinely *concurrent* double-submit — two requests arriving
 * together can both pass the pre-check before either has inserted
 * anything. The actual source of truth for that case is the
 * `organization_members_user_id_key` UNIQUE constraint (see
 * supabase/migrations/20260812000000_organization_members_user_id_unique.sql):
 * when two concurrent requests both reach the membership insert, Postgres
 * itself accepts exactly one and rejects the other with a 23505
 * unique_violation, which the catch block below converts into the same
 * 409 the sequential case returns — never a 500, and never a raw
 * Postgres error reaching the client.
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

    // A concurrent request won the race and inserted this user's
    // membership first — the database constraint (not just our earlier
    // in-memory checks) is what caught it. Same friendly message and
    // status as every other "already have an organization" case.
    if (isUniqueViolation(membershipError)) {
      throw new Error(ALREADY_HAS_ORGANIZATION_MESSAGE);
    }

    throw membershipError;
  }

  return organization;
}

/**
 * organization_members only stores user_id — resolving a
 * human-readable email requires the Supabase Auth admin API.
 * Run in parallel; a lookup failure for one user degrades to a
 * null email for that row rather than failing the whole list.
 * Exported for reuse by invitations.service.ts (resolving the
 * inviter's email for invitation emails and duplicate-member checks).
 */
export async function resolveEmail(
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
