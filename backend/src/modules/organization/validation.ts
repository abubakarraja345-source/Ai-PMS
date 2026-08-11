import { OrganizationRole } from "../../middleware/organization.middleware";

/**
 * Roles assignable through the member-management API. "owner"
 * is deliberately excluded — ownership transfer is explicitly
 * out of scope (approved rule: "Cannot transfer ownership"), so
 * nobody can be promoted to owner through this endpoint.
 */
const ASSIGNABLE_ROLES = [
  "company_admin",
  "member",
] as const;

type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

function isAssignableRole(
  value: string
): value is AssignableRole {
  return (ASSIGNABLE_ROLES as readonly string[]).includes(
    value
  );
}

export interface ChangeRoleInput {
  role: OrganizationRole;
}

export function validateChangeRole(
  input: unknown
): ChangeRoleInput {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid request body");
  }

  const data = input as Record<string, unknown>;

  if (
    typeof data.role !== "string" ||
    !isAssignableRole(data.role.trim())
  ) {
    throw new Error(
      `role must be one of: ${ASSIGNABLE_ROLES.join(", ")}`
    );
  }

  return { role: data.role.trim() as OrganizationRole };
}

export interface CreateOrganizationInput {
  name: string;
  country: string | null;
  timezone: string | null;
}

/**
 * Onboarding's create-workspace form. Only `name` is required —
 * `country`/`timezone` mirror the two optional, freely-typed fields
 * the organizations table actually has room for (confirmed via schema
 * introspection); no enum is enforced for either, matching how
 * settings/validation.ts already treats timezone/currency as
 * free text.
 */
export function validateCreateOrganization(
  input: unknown
): CreateOrganizationInput {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid request body");
  }

  const data = input as Record<string, unknown>;

  if (typeof data.name !== "string" || !data.name.trim()) {
    throw new Error("Organization name is required");
  }

  const name = data.name.trim();

  if (name.length < 2) {
    throw new Error("Organization name must be at least 2 characters");
  }

  if (name.length > 120) {
    throw new Error("Organization name must be 120 characters or fewer");
  }

  let country: string | null = null;

  if (
    data.country !== undefined &&
    data.country !== null &&
    data.country !== ""
  ) {
    if (typeof data.country !== "string") {
      throw new Error("country must be a string");
    }

    country = data.country.trim() || null;
  }

  let timezone: string | null = null;

  if (
    data.timezone !== undefined &&
    data.timezone !== null &&
    data.timezone !== ""
  ) {
    if (typeof data.timezone !== "string") {
      throw new Error("timezone must be a string");
    }

    timezone = data.timezone.trim() || null;
  }

  return { name, country, timezone };
}
