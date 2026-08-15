/**
 * Roles an invitation may grant. "owner" is deliberately excluded —
 * an invitation can never create a second owner (the organization
 * owner is unique, assigned only at organization-creation time). Same
 * exclusion already enforced for the member-role-change endpoint in
 * organization/validation.ts's ASSIGNABLE_ROLES.
 *
 * Phase 7 — widened from the original 2 to all 5 non-owner roles,
 * matching the widened organization_invitations_role_check CHECK
 * constraint (20260817000000_widen_invitation_roles.sql) — this list
 * and that constraint must stay in sync; this is the app-level
 * validation layer, the DB constraint is the backstop.
 */
export const INVITABLE_ROLES = [
  "company_admin",
  "manager",
  "host",
  "member",
  "spectator",
] as const;

export type InvitableRole = (typeof INVITABLE_ROLES)[number];

function isInvitableRole(value: string): value is InvitableRole {
  return (INVITABLE_ROLES as readonly string[]).includes(value);
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CreateInvitationInput {
  email: string;
  fullName: string | null;
  role: InvitableRole;
}

export function validateCreateInvitation(
  input: unknown
): CreateInvitationInput {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid request body");
  }

  const data = input as Record<string, unknown>;

  if (typeof data.email !== "string" || !data.email.trim()) {
    throw new Error("Email is required");
  }

  const email = data.email.trim().toLowerCase();

  if (!EMAIL_PATTERN.test(email)) {
    throw new Error("Email must be a valid email address");
  }

  let fullName: string | null = null;

  if (
    data.full_name !== undefined &&
    data.full_name !== null &&
    data.full_name !== ""
  ) {
    if (typeof data.full_name !== "string") {
      throw new Error("full_name must be a string");
    }

    const trimmed = data.full_name.trim();

    if (trimmed.length > 200) {
      throw new Error("full_name must be 200 characters or fewer");
    }

    fullName = trimmed || null;
  }

  if (
    typeof data.role !== "string" ||
    !isInvitableRole(data.role.trim())
  ) {
    throw new Error(
      `role must be one of: ${INVITABLE_ROLES.join(", ")}`
    );
  }

  return {
    email,
    fullName,
    role: data.role.trim() as InvitableRole,
  };
}

