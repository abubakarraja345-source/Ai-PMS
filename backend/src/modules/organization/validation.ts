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
