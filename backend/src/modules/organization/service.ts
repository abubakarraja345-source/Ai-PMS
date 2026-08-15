import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

import { env } from "../../config/env";
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
import {
  CreateOrganizationInput,
  RegisterOrganizationInput,
  validateCreateOrganization,
  validateRegisterOrganization,
} from "./validation";
import { supabase } from "../../config/supabase";
import { isOrganizationRole } from "../../middleware/organization.middleware";

import {
  notifyMemberRemoved,
  notifyMemberRoleChanged,
} from "../notifications/service";

import { logAudit } from "../auditLog/service";

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
 * Looks up an existing Supabase auth user by email. supabase-js's
 * admin API has no direct "get user by email" call, so this pages
 * through admin.listUsers() — the same "good enough at this
 * product's scale" tradeoff already made by resolveEmail/listMembers
 * below (which do an N-lookup per organization's member list rather
 * than maintaining a denormalized email column). Used by both
 * registration (reject a duplicate email with a friendly message
 * instead of a raw Supabase error) and team-member provisioning
 * (reuse an existing account instead of trying to create a second
 * one with the same email, which Supabase would reject anyway).
 */
export async function findAuthUserByEmail(
  email: string
): Promise<{ id: string; email: string | null } | null> {
  const normalized = email.trim().toLowerCase();
  const perPage = 1000;

  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw error;
    }

    const match = data.users.find(
      (u) => u.email?.toLowerCase() === normalized
    );

    if (match) {
      return { id: match.id, email: match.email ?? null };
    }

    if (data.users.length < perPage) {
      return null;
    }
  }

  return null;
}

/**
 * A random, human-typeable temporary password for newly-provisioned
 * team-member accounts — crypto.randomBytes (never Math.random), a
 * charset with ambiguous characters (0/O, 1/l/I) removed since this
 * is emailed as plain text and may need to be typed by hand, and long
 * enough (16 chars from a 57-character set) to be a strong password
 * on its own even though the recipient is always forced to change it
 * before doing anything else (see the invited account's
 * must_change_password user_metadata flag).
 */
export function generateTempPassword(): string {
  const charset =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = crypto.randomBytes(16);
  let password = "";

  for (const byte of bytes) {
    password += charset[byte % charset.length];
  }

  return password;
}

/**
 * Self-service registration: creates the owner's password-based auth
 * account and their organization together, atomically from the
 * caller's point of view. Public (no session exists yet) — unlike
 * createOrganization above (onboarding, requires an existing
 * session), this is the very first step for a brand-new user.
 *
 * Ordering matters for the rollback story: the auth account is
 * created first since it's the thing every later step depends on: if
 * organization creation fails, the just-created auth account is
 * deleted so the email is immediately retryable (no orphaned account
 * silently blocking `findAuthUserByEmail` on a later attempt). If the
 * membership insert fails after the organization was created, both
 * the organization AND the auth account are rolled back — mirroring
 * createOrganization's existing org-only rollback, extended one level
 * further since this flow owns the account too.
 */
export async function registerOrganization(rawInput: unknown) {
  const input: RegisterOrganizationInput =
    validateRegisterOrganization(rawInput);

  const existing = await findAuthUserByEmail(input.email);

  if (existing) {
    throw new Error(
      "An account with this email already exists — please log in instead"
    );
  }

  const { data: created, error: createUserError } =
    await supabase.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: input.fullName },
    });

  if (createUserError || !created?.user) {
    throw new Error(
      createUserError?.message || "Unable to create your account"
    );
  }

  const userId = created.user.id;

  try {
    const slug = await generateUniqueSlug(input.organizationName);

    const organization = await insertOrganization({
      name: input.organizationName,
      slug,
      country: input.country,
      timezone: null,
      email: input.email,
      phone: input.phone,
      numberOfListings: input.numberOfListings,
      propertyTypes: input.propertyTypes,
      referralSource: input.referralSource,
    });

    try {
      await insertMembership(organization.id, userId, "owner");
    } catch (membershipError) {
      await deleteOrganizationById(organization.id).catch((cleanupError) => {
        console.error(
          "Failed to roll back organization after a failed registration membership insert:",
          cleanupError
        );
      });

      throw membershipError;
    }

    void logAudit({
      organizationId: organization.id,
      actorUserId: userId,
      actorLabel: input.email,
      action: "organization.registered",
      entityType: "organization",
      entityId: organization.id,
      metadata: {
        country: input.country,
        numberOfListings: input.numberOfListings,
        propertyTypes: input.propertyTypes,
        referralSource: input.referralSource,
      },
    });

    return { id: organization.id, name: organization.name };
  } catch (error) {
    await supabase.auth.admin.deleteUser(userId).catch((cleanupError) => {
      console.error(
        "Failed to roll back auth account after a failed registration:",
        cleanupError
      );
    });

    throw error;
  }
}

/**
 * Password login, proxied through our backend rather than called
 * directly from the frontend against Supabase — the entire point is
 * giving loginRateLimiter (rateLimiter.ts) a choke point to sit in
 * front of, which a direct client-side supabase-js call would bypass
 * entirely. Returns the raw session Supabase issues; the frontend
 * hydrates its own browser client from it via supabase.auth.setSession,
 * exactly as if it had signed in directly.
 *
 * Deliberately returns the same generic message for "no such email"
 * and "wrong password" — distinguishing them would let an attacker
 * enumerate registered emails.
 *
 * Critical: this must NOT call signInWithPassword on the shared
 * `supabase` singleton (config/supabase.ts) — doing so was tried
 * first and caught live, the hard way. supabase-js wires a client's
 * `auth` state into every `.from()`/`.rpc()` call made through that
 * SAME client instance: the moment signInWithPassword succeeds, the
 * shared client silently starts sending every subsequent request
 * (from every other module in this process — requireOrganization,
 * every repository, everything) as that logged-in USER's JWT instead
 * of the service-role key, which has none of the table grants
 * `authenticated` has (see "no RLS anywhere; service_role is the only
 * DB role with any grants" — the architectural invariant this whole
 * backend depends on). One successful login would have silently
 * broken every other request in the running process until restart.
 * A throwaway client, used once and discarded, keeps the shared
 * singleton's session untouched no matter how many people log in.
 */
export async function loginWithPassword(email: string, password: string) {
  if (typeof email !== "string" || !email.trim()) {
    throw new Error("Email is required");
  }

  if (typeof password !== "string" || !password) {
    throw new Error("Password is required");
  }

  const scopedClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await scopedClient.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error || !data.session) {
    throw new Error("Invalid email or password");
  }

  return {
    session: data.session,
    user: data.user,
  };
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
  newRole: string,
  callerEmail?: string
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

    void logAudit({
      organizationId,
      actorUserId: callerUserId,
      actorLabel: callerEmail ?? callerUserId,
      action: "member.role_changed",
      entityType: "member",
      entityId: targetMemberId,
      metadata: {
        targetUserId: target.user_id,
        previousRole: target.role,
        newRole,
      },
    });
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
  targetMemberId: string,
  callerEmail?: string
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

    void logAudit({
      organizationId,
      actorUserId: callerUserId,
      actorLabel: callerEmail ?? callerUserId,
      action: "member.removed",
      entityType: "member",
      entityId: targetMemberId,
      metadata: { targetUserId: target.user_id, previousRole: target.role },
    });
  }

  return deleted;
}
