import { OrganizationRole } from "./roles";
import { RESOURCE_ACTIONS, ResourceAction } from "./resourceActions";

export type PermissionEffect = "allow" | "deny" | "approval";

type ManagedRole = Exclude<OrganizationRole, "owner">;

/**
 * The authoritative role -> permission matrix (Phase 7).
 *
 * `owner` is intentionally not listed per-action below — it is always
 * `"allow"` for every resource.action (see PERMISSION_MATRIX's
 * assembly at the bottom). Nothing in this application currently
 * restricts the owner from any org-level capability; the things the
 * spec says an owner "cannot" do (bypass platform-level Super Admin
 * security, delete audit records) aren't org-level permissions at
 * all — the former is enforced entirely by the separate
 * platform-admin system, the latter isn't a capability that exists
 * anywhere in the app (no DELETE route on audit_log exists).
 *
 * `company_admin` (labeled "Admin" — see roles.ts) is, for every
 * action below, identical to today's actual behavior: every existing
 * `requireRole("owner", "company_admin")` gate in this codebase never
 * distinguished the two, so this matrix reproduces that exactly
 * rather than inventing a new restriction on day one.
 *
 * manager/host/member/spectator are new. Where the Phase 7 spec's
 * role definitions explicitly grant a capability, it's "allow" here;
 * everywhere the spec is silent or explicitly withholds it, the
 * default is "deny" — a permission system should never grant more
 * than what was explicitly asked for. Adjustable per-organization via
 * role_permission_overrides without a code change.
 *
 * The ONLY non-allow/deny default anywhere in this matrix:
 * member x {reservations.reschedule, reservations.cancel,
 * reservations.financial_update} = "approval" — the confirmed
 * on-by-default Member approval rule. An owner who wants their
 * Members editing reservations freely (today's pre-Phase-7 behavior)
 * inserts a role_permission_overrides row with effect="allow" for
 * that (role, resource_action) pair; no code change needed.
 */
const BASE: Partial<
  Record<ResourceAction, Partial<Record<ManagedRole, PermissionEffect>>>
> = {
  "properties.read": {
    company_admin: "allow",
    manager: "allow",
    host: "allow",
    member: "allow",
    spectator: "allow",
  },
  "properties.create": { company_admin: "allow" },
  "properties.update": { company_admin: "allow", manager: "allow" },
  "properties.delete": { company_admin: "allow" },

  "reservations.read": {
    company_admin: "allow",
    manager: "allow",
    host: "allow",
    member: "allow",
    spectator: "allow",
  },
  "reservations.create": {
    company_admin: "allow",
    manager: "allow",
    member: "allow",
  },
  "reservations.update": {
    company_admin: "allow",
    manager: "allow",
    member: "allow",
  },
  "reservations.delete": { company_admin: "allow" },
  "reservations.review": { company_admin: "allow", manager: "allow" },
  "reservations.reschedule": {
    company_admin: "allow",
    manager: "allow",
    member: "approval",
  },
  "reservations.cancel": {
    company_admin: "allow",
    manager: "allow",
    member: "approval",
  },
  "reservations.financial_update": {
    company_admin: "allow",
    manager: "allow",
    member: "approval",
  },

  "calendar.read": {
    company_admin: "allow",
    manager: "allow",
    host: "allow",
    member: "allow",
    spectator: "allow",
  },

  "guests.read": {
    company_admin: "allow",
    manager: "allow",
    host: "allow",
    member: "allow",
    spectator: "allow",
  },
  "guests.create": { company_admin: "allow", manager: "allow", member: "allow" },
  "guests.update": { company_admin: "allow", manager: "allow", member: "allow" },
  "guests.delete": { company_admin: "allow" },

  "team.read": {
    company_admin: "allow",
    manager: "allow",
    member: "allow",
  },
  "team.invite": { company_admin: "allow" },
  "team.manage_roles": { company_admin: "allow" },
  "team.remove": { company_admin: "allow" },
  "team.assign_properties": { company_admin: "allow", manager: "allow" },

  "integrations.read": {
    company_admin: "allow",
    manager: "allow",
    member: "allow",
  },
  "integrations.create": { company_admin: "allow" },
  "integrations.update": { company_admin: "allow" },
  "integrations.delete": { company_admin: "allow" },
  "integrations.sync": { company_admin: "allow", manager: "allow" },

  "reports.read": {
    company_admin: "allow",
    manager: "allow",
    member: "allow",
    spectator: "allow",
  },
  "reports.export": {
    company_admin: "allow",
    manager: "allow",
    member: "allow",
    spectator: "allow",
  },

  "financials.read": {
    company_admin: "allow",
    manager: "allow",
    host: "allow",
    member: "allow",
    spectator: "allow",
  },
  "financials.update": { company_admin: "allow" },

  "organization.read": {
    company_admin: "allow",
    manager: "allow",
    host: "allow",
    member: "allow",
    spectator: "allow",
  },
  "organization.update": { company_admin: "allow" },

  "audit.read": { company_admin: "allow", manager: "allow" },

  "ai.read": {
    company_admin: "allow",
    manager: "allow",
    host: "allow",
    member: "allow",
  },
  "ai.use": {
    company_admin: "allow",
    manager: "allow",
    host: "allow",
    member: "allow",
  },

  "maintenance.read": {
    company_admin: "allow",
    manager: "allow",
    host: "allow",
    member: "allow",
  },
  "maintenance.create": {
    company_admin: "allow",
    manager: "allow",
    host: "allow",
    member: "allow",
  },
  "maintenance.update": {
    company_admin: "allow",
    manager: "allow",
    host: "allow",
    member: "allow",
  },
  "maintenance.delete": { company_admin: "allow" },

  "cleaning.read": {
    company_admin: "allow",
    manager: "allow",
    host: "allow",
    member: "allow",
  },
  "cleaning.create": {
    company_admin: "allow",
    manager: "allow",
    host: "allow",
    member: "allow",
  },
  "cleaning.update": {
    company_admin: "allow",
    manager: "allow",
    host: "allow",
    member: "allow",
  },
  "cleaning.delete": { company_admin: "allow" },

  "inventory.read": {
    company_admin: "allow",
    manager: "allow",
    member: "allow",
  },
  "inventory.create": { company_admin: "allow" },
  "inventory.update": { company_admin: "allow" },
  "inventory.delete": { company_admin: "allow" },

  "approvals.review": { company_admin: "allow", manager: "allow" },
};

function buildMatrix(): Record<
  ResourceAction,
  Record<OrganizationRole, PermissionEffect>
> {
  const entries = RESOURCE_ACTIONS.map((action) => {
    const row = BASE[action] ?? {};

    const full: Record<OrganizationRole, PermissionEffect> = {
      owner: "allow",
      company_admin: row.company_admin ?? "deny",
      manager: row.manager ?? "deny",
      host: row.host ?? "deny",
      member: row.member ?? "deny",
      spectator: row.spectator ?? "deny",
    };

    return [action, full] as const;
  });

  return Object.fromEntries(entries) as Record<
    ResourceAction,
    Record<OrganizationRole, PermissionEffect>
  >;
}

export const PERMISSION_MATRIX = buildMatrix();
