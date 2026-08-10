import { findReservationsByOrganizationInRange } from "./repository";
import { verifyProperty } from "../reservations/service";

export async function getCalendarReservations(
  organizationId: string,
  start: string,
  end: string,
  propertyId?: string
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

  return findReservationsByOrganizationInRange(
    organizationId,
    start,
    end,
    propertyId
  );
}
