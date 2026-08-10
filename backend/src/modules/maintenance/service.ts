import {
  findMaintenanceTicketsByOrganization,
  findMaintenanceTicketById,
  createMaintenanceTicket,
  updateMaintenanceTicket,
  deleteMaintenanceTicket,
} from "./repository";

import {
  CreateMaintenanceTicketInput,
  MaintenanceTicketFilters,
  MaintenanceStatus,
  isValidStatusTransition,
} from "./validation";

import { verifyProperty } from "../reservations/service";
import { findReservationById } from "../reservations/repository";

import {
  notifyMaintenanceCreated,
  notifyMaintenanceStatusChanged,
} from "../notifications/service";

export async function getMaintenanceTickets(
  organizationId: string,
  filters: MaintenanceTicketFilters
) {
  return findMaintenanceTicketsByOrganization(
    organizationId,
    filters
  );
}

export async function getMaintenanceTicket(
  organizationId: string,
  ticketId: string
) {
  return findMaintenanceTicketById(organizationId, ticketId);
}

/**
 * Verifies the reservation belongs to the org (reusing the
 * existing org-scoped lookup) and, when a property is also
 * specified, that the reservation actually belongs to it.
 */
async function verifyReservationForProperty(
  organizationId: string,
  reservationId: string,
  propertyId: string
) {
  const reservation = await findReservationById(
    organizationId,
    reservationId
  );

  if (!reservation) {
    throw new Error(
      "Reservation not found in your organization"
    );
  }

  if (reservation.property_id !== propertyId) {
    throw new Error(
      "Reservation does not belong to the selected property"
    );
  }
}

export async function addMaintenanceTicket(
  organizationId: string,
  reportedBy: string,
  input: CreateMaintenanceTicketInput
) {
  const propertyBelongsToOrg = await verifyProperty(
    organizationId,
    input.property_id
  );

  if (!propertyBelongsToOrg) {
    throw new Error(
      "Property not found in your organization"
    );
  }

  if (input.reservation_id) {
    await verifyReservationForProperty(
      organizationId,
      input.reservation_id,
      input.property_id
    );
  }

  // A ticket created directly as "resolved" still needs its
  // resolved_at timestamp set, same as an update-driven
  // transition would.
  const resolvedAt =
    input.status === "resolved"
      ? new Date().toISOString()
      : null;

  const ticket = await createMaintenanceTicket(
    organizationId,
    reportedBy,
    { ...input, resolved_at: resolvedAt }
  );

  await notifyMaintenanceCreated(organizationId, ticket);

  return ticket;
}

export async function editMaintenanceTicket(
  organizationId: string,
  ticketId: string,
  updates: Record<string, unknown>
) {
  const existing = await findMaintenanceTicketById(
    organizationId,
    ticketId
  );

  if (!existing) {
    return null;
  }

  const effectivePropertyId =
    (updates.property_id as string | undefined) ??
    existing.property_id;

  if (
    updates.property_id !== undefined &&
    updates.property_id !== existing.property_id
  ) {
    const propertyBelongsToOrg = await verifyProperty(
      organizationId,
      updates.property_id as string
    );

    if (!propertyBelongsToOrg) {
      throw new Error(
        "Property not found in your organization"
      );
    }
  }

  if (
    updates.reservation_id !== undefined &&
    updates.reservation_id !== existing.reservation_id &&
    updates.reservation_id !== null
  ) {
    await verifyReservationForProperty(
      organizationId,
      updates.reservation_id as string,
      effectivePropertyId
    );
  }

  if (updates.status !== undefined) {
    const currentStatus = existing.status as MaintenanceStatus;
    const nextStatus = updates.status as MaintenanceStatus;

    if (!isValidStatusTransition(currentStatus, nextStatus)) {
      throw new Error(
        `Cannot change status from "${currentStatus}" to "${nextStatus}"`
      );
    }

    if (nextStatus === "resolved") {
      updates.resolved_at = new Date().toISOString();
    }

    // resolved -> in_progress clears resolved_at (it's no
    // longer accurate); resolved -> closed preserves it
    // (no action needed — it's simply not touched).
    if (
      currentStatus === "resolved" &&
      nextStatus === "in_progress"
    ) {
      updates.resolved_at = null;
    }
  }

  /*
   * Prevent protected fields from being changed by the client.
   */
  if ("id" in updates) delete updates.id;
  if ("organization_id" in updates)
    delete updates.organization_id;
  if ("reported_by" in updates) delete updates.reported_by;
  if ("opened_at" in updates) delete updates.opened_at;
  if ("created_at" in updates) delete updates.created_at;

  const statusChanged =
    updates.status !== undefined &&
    updates.status !== existing.status;

  const updated = await updateMaintenanceTicket(
    organizationId,
    ticketId,
    updates
  );

  if (updated && statusChanged) {
    await notifyMaintenanceStatusChanged(
      organizationId,
      updated,
      updated.status
    );
  }

  return updated;
}

export async function removeMaintenanceTicket(
  organizationId: string,
  ticketId: string
) {
  const existing = await findMaintenanceTicketById(
    organizationId,
    ticketId
  );

  if (!existing) {
    return false;
  }

  return deleteMaintenanceTicket(organizationId, ticketId);
}
