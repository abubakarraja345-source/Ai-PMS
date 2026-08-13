/**
 * Every resource.action this application actually has a real code
 * path for — deliberately NOT a speculative superset of "things a PMS
 * might someday do." Each entry corresponds to functionality that
 * already exists (grounded in the same route-by-route inspection
 * that produced matrix.ts's defaults), so the permission engine never
 * claims to gate a capability the app doesn't have.
 */
export const RESOURCE_ACTIONS = [
  "properties.read",
  "properties.create",
  "properties.update",
  "properties.delete",

  "reservations.read",
  "reservations.create",
  "reservations.update",
  "reservations.delete",
  "reservations.review",
  "reservations.reschedule",
  "reservations.cancel",
  "reservations.financial_update",

  "calendar.read",

  "guests.read",
  "guests.create",
  "guests.update",
  "guests.delete",

  "team.read",
  "team.invite",
  "team.manage_roles",
  "team.remove",
  "team.assign_properties",

  "integrations.read",
  "integrations.create",
  "integrations.update",
  "integrations.delete",
  "integrations.sync",

  "reports.read",
  "reports.export",

  "financials.read",
  "financials.update",

  "organization.read",
  "organization.update",

  "audit.read",

  "ai.read",
  "ai.use",

  "maintenance.read",
  "maintenance.create",
  "maintenance.update",
  "maintenance.delete",

  "cleaning.read",
  "cleaning.create",
  "cleaning.update",
  "cleaning.delete",

  "inventory.read",
  "inventory.create",
  "inventory.update",
  "inventory.delete",

  "approvals.review",
] as const;

export type ResourceAction = (typeof RESOURCE_ACTIONS)[number];

export function isResourceAction(value: string): value is ResourceAction {
  return (RESOURCE_ACTIONS as readonly string[]).includes(value);
}
