import {
  OrganizationRole,
  ORGANIZATION_ROLES,
} from "../../middleware/organization.middleware";

export { ORGANIZATION_ROLES };
export type { OrganizationRole };

/**
 * Display labels — this is the compatibility layer the Phase 7 spec
 * asked for: "company_admin" is never renamed in the database (every
 * existing row, invitation, and piece of code that compares against
 * the literal string keeps working unchanged), it's just labeled
 * "Admin" everywhere a human reads it.
 */
export const ROLE_LABELS: Record<OrganizationRole, string> = {
  owner: "Owner",
  company_admin: "Admin",
  manager: "Manager",
  host: "Host",
  member: "Member",
  spectator: "Spectator",
};

/**
 * Seniority ordering, highest first — used for "can this role review
 * a request submitted by that role" (approvals) and for the Team
 * page's role-change preview. Not used for permission lookups
 * themselves (those go through the matrix), only for relative
 * comparisons between two roles.
 */
export const ROLE_RANK: Record<OrganizationRole, number> = {
  owner: 5,
  company_admin: 4,
  manager: 3,
  host: 2,
  member: 1,
  spectator: 0,
};
