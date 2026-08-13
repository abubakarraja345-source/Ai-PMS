import { findReservationsByOrganizationInRange } from "./repository";
import { verifyProperty } from "../reservations/service";
import { OrganizationRole } from "../permissions/roles";
import {
  resolvePropertyScope,
  reconcileSinglePropertyFilter,
} from "../permissions/propertyScope";

export async function getCalendarReservations(
  organizationId: string,
  start: string,
  end: string,
  propertyId?: string,
  caller?: { role: OrganizationRole; userId: string }
) {
  if (!organizationId) {
    throw new Error("Organization ID is required");
  }

  if (propertyId) {
    const belongsToOrg = await verifyProperty(
      organizationId,
      propertyId
    );

    if (!belongsToOrg) {
      throw new Error(
        "Property not found in your organization"
      );
    }
  }

  if (!caller) {
    return findReservationsByOrganizationInRange(
      organizationId,
      start,
      end,
      propertyId
    );
  }

  // Phase 7.4 — property-level access.
  const scope = await resolvePropertyScope(organizationId, caller.role, caller.userId);
  const reconciled = reconcileSinglePropertyFilter(scope, propertyId);

  if (reconciled.empty) {
    return [];
  }

  return findReservationsByOrganizationInRange(
    organizationId,
    start,
    end,
    reconciled.propertyId,
    reconciled.propertyIds
  );
}
