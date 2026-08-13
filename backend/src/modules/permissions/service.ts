import { OrganizationRole } from "./roles";
import { RESOURCE_ACTIONS, ResourceAction } from "./resourceActions";
import { PERMISSION_MATRIX, PermissionEffect } from "./matrix";
import { findOverridesByOrganization } from "./repository";

/**
 * The single source of truth both `requirePermission` (backend
 * enforcement) and `GET /api/organization/me` (frontend UX hints) call
 * — this is what guarantees the two can never drift apart: there is
 * no second copy of "what can this role do" anywhere.
 *
 * Checks role_permission_overrides first (an organization's explicit
 * customization), falling back to the hardcoded PERMISSION_MATRIX
 * default when no override row exists — which is every organization,
 * until an owner/admin explicitly changes something (see
 * role_permission_overrides migration's own comment).
 */
export async function getEffect(
  organizationId: string,
  role: OrganizationRole,
  resourceAction: ResourceAction
): Promise<PermissionEffect> {
  const overrides = await findOverridesByOrganization(organizationId);

  const override = overrides.find(
    (o) => o.role === role && o.resource_action === resourceAction
  );

  if (override) {
    return override.effect;
  }

  return PERMISSION_MATRIX[resourceAction][role];
}

export interface EffectivePermissions {
  /** Every resource.action currently resolving to "allow" for this
   * role — what the frontend uses for simple can(action) checks. */
  permissions: ResourceAction[];
  /** The full effect (including "approval") for every resource.action
   * — lets the frontend show "Requires approval" affordances before
   * submit rather than discovering it from a 202 response. */
  permissionEffects: Record<ResourceAction, PermissionEffect>;
}

export async function getEffectivePermissions(
  organizationId: string,
  role: OrganizationRole
): Promise<EffectivePermissions> {
  const overrides = await findOverridesByOrganization(organizationId);
  const overrideMap = new Map(
    overrides
      .filter((o) => o.role === role)
      .map((o) => [o.resource_action, o.effect])
  );

  const permissionEffects = {} as Record<ResourceAction, PermissionEffect>;

  for (const action of RESOURCE_ACTIONS) {
    permissionEffects[action] =
      overrideMap.get(action) ?? PERMISSION_MATRIX[action][role];
  }

  const permissions = RESOURCE_ACTIONS.filter(
    (action) => permissionEffects[action] === "allow"
  );

  return { permissions, permissionEffects };
}
