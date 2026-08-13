import { OrganizationRole } from "./roles";
import { RESOURCE_ACTIONS, ResourceAction } from "./resourceActions";
import { PERMISSION_MATRIX, PermissionEffect } from "./matrix";
import {
  deleteOverride,
  findOverridesByOrganization,
  upsertOverride,
} from "./repository";

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

/** The 3 resource_actions the matrix defaults to "approval" for
 * role=member (see matrix.ts's own comment) — the single bundled
 * toggle exposed to owners/admins in this checkpoint. */
const MEMBER_APPROVAL_ACTIONS: ResourceAction[] = [
  "reservations.reschedule",
  "reservations.cancel",
  "reservations.financial_update",
];

/**
 * true = approval is required (either the matrix default with no
 * override, or an explicit 'approval' override); false = an owner has
 * overridden all three to 'allow', restoring pre-Phase-7 free-editing
 * behavior for Members. Reports true unless EVERY one of the 3
 * actions is explicitly overridden to 'allow' — a partial override
 * (e.g. only reschedule turned off) is surfaced as "still requires
 * approval" rather than a misleading fully-off toggle state.
 */
export async function getMemberApprovalSetting(
  organizationId: string
): Promise<boolean> {
  const overrides = await findOverridesByOrganization(organizationId);
  const overrideMap = new Map(
    overrides.filter((o) => o.role === "member").map((o) => [o.resource_action, o.effect])
  );

  return !MEMBER_APPROVAL_ACTIONS.every(
    (action) => overrideMap.get(action) === "allow"
  );
}

export async function setMemberApprovalSetting(
  organizationId: string,
  requireApproval: boolean
): Promise<void> {
  if (requireApproval) {
    // Remove any 'allow' overrides so the matrix default ('approval')
    // takes effect again.
    await Promise.all(
      MEMBER_APPROVAL_ACTIONS.map((action) =>
        deleteOverride(organizationId, "member", action)
      )
    );
  } else {
    await Promise.all(
      MEMBER_APPROVAL_ACTIONS.map((action) =>
        upsertOverride(organizationId, "member", action, "allow")
      )
    );
  }
}
