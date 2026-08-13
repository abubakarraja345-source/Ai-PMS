import { OrganizationRole } from "./roles";
import { findAssignedPropertyIds } from "./propertyAssignments.repository";

export interface PropertyScope {
  restricted: boolean;
  /** Only meaningful when restricted=true. Empty array means
   * fail-closed: this user is restricted but has zero assignments,
   * so they should see NO properties, not every property. */
  propertyIds: string[];
}

const UNRESTRICTED_ROLES: OrganizationRole[] = ["owner", "company_admin"];

/**
 * Phase 7.4 — the single source of truth for "which properties can
 * this user see." Owner/Admin are never restricted (they manage the
 * whole organization). Manager/Host/Spectator are restricted to their
 * explicit property_assignments rows — fail-closed: an unassigned
 * Manager/Host/Spectator sees zero properties, never "everything,"
 * since a missing assignment is far more likely to be an
 * administrative oversight than an intentional "give this role
 * org-wide access" signal.
 *
 * "member" is deliberately NOT restricted here — the Phase 7 spec's
 * role definitions describe Manager/Host/Spectator as scoped to
 * "assigned properties" but Member as seeing "permitted properties"
 * (permission-gated, not property-gated), matching today's existing
 * behavior for that role.
 */
export async function resolvePropertyScope(
  organizationId: string,
  role: OrganizationRole,
  userId: string
): Promise<PropertyScope> {
  if (UNRESTRICTED_ROLES.includes(role) || role === "member") {
    return { restricted: false, propertyIds: [] };
  }

  const propertyIds = await findAssignedPropertyIds(organizationId, userId);

  return { restricted: true, propertyIds };
}

/**
 * Reconciles a caller's property scope against an optional single
 * `property_id` request filter (e.g. `GET /api/reservations?
 * property_id=X`, `GET /api/calendar?property_id=X`). Returns the
 * effective property_id filter to apply, or throws if the caller
 * explicitly asked for a property outside their assigned set — same
 * "not found in your organization" style error every other
 * cross-boundary access attempt in this codebase already produces,
 * so a restricted user probing for another property's data gets a
 * clean, unrevealing 404/400 rather than a distinct "forbidden"
 * signal that would confirm the property exists.
 */
export function reconcileSinglePropertyFilter(
  scope: PropertyScope,
  requestedPropertyId: string | undefined
): { propertyId?: string; propertyIds?: string[]; empty?: boolean } {
  if (!scope.restricted) {
    return requestedPropertyId ? { propertyId: requestedPropertyId } : {};
  }

  if (scope.propertyIds.length === 0) {
    return { empty: true };
  }

  if (requestedPropertyId) {
    if (!scope.propertyIds.includes(requestedPropertyId)) {
      return { empty: true };
    }

    return { propertyId: requestedPropertyId };
  }

  return { propertyIds: scope.propertyIds };
}
