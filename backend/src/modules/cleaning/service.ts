import {
  findCleaningTasksByOrganization,
  findCleaningTaskById,
  createCleaningTask,
  updateCleaningTask,
  deleteCleaningTask,
} from "./repository";

import {
  CreateCleaningTaskInput,
  CleaningTaskFilters,
  CleaningStatus,
  isValidStatusTransition,
} from "./validation";

import { verifyProperty } from "../reservations/service";
import { findReservationById } from "../reservations/repository";

import {
  notifyCleaningCreated,
  notifyCleaningStatusChanged,
} from "../notifications/service";

import { OrganizationRole } from "../permissions/roles";
import { resolvePropertyScope } from "../permissions/propertyScope";

export interface CallerScopeContext {
  role: OrganizationRole;
  userId: string;
}

export async function getCleaningTasks(
  organizationId: string,
  filters: CleaningTaskFilters,
  range: { from: number; to: number },
  caller?: CallerScopeContext
) {
  if (!caller) {
    return findCleaningTasksByOrganization(organizationId, filters, range);
  }

  const scope = await resolvePropertyScope(organizationId, caller.role, caller.userId);

  if (scope.restricted && scope.propertyIds.length === 0) {
    return { data: [], total: 0 };
  }

  return findCleaningTasksByOrganization(
    organizationId,
    scope.restricted ? { ...filters, propertyIds: scope.propertyIds } : filters,
    range
  );
}

export async function getCleaningTask(
  organizationId: string,
  taskId: string,
  caller?: CallerScopeContext
) {
  const task = await findCleaningTaskById(organizationId, taskId);

  if (!task || !caller) {
    return task;
  }

  const scope = await resolvePropertyScope(organizationId, caller.role, caller.userId);

  if (scope.restricted && !scope.propertyIds.includes(task.property_id)) {
    return null;
  }

  return task;
}

/**
 * Verifies the reservation belongs to the org (reusing the
 * existing org-scoped lookup rather than a new ownership
 * helper) and, when a property is also specified, that the
 * reservation actually belongs to that property.
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

export async function addCleaningTask(
  organizationId: string,
  input: CreateCleaningTaskInput
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

  // A task created directly in a later-stage status still
  // needs its workflow timestamps set, same as an update would.
  const timestamps: {
    started_at?: string;
    completed_at?: string;
  } = {};

  if (
    input.status === "in_progress" ||
    input.status === "completed"
  ) {
    timestamps.started_at = new Date().toISOString();
  }

  if (input.status === "completed") {
    timestamps.completed_at = new Date().toISOString();
  }

  const task = await createCleaningTask(organizationId, {
    ...input,
    ...timestamps,
  });

  await notifyCleaningCreated(organizationId, task);

  return task;
}

export async function editCleaningTask(
  organizationId: string,
  taskId: string,
  updates: Record<string, unknown>
) {
  const existing = await findCleaningTaskById(
    organizationId,
    taskId
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
    const currentStatus = existing.status as CleaningStatus;
    const nextStatus = updates.status as CleaningStatus;

    if (!isValidStatusTransition(currentStatus, nextStatus)) {
      throw new Error(
        `Cannot change status from "${currentStatus}" to "${nextStatus}"`
      );
    }

    if (nextStatus === "in_progress" && !existing.started_at) {
      updates.started_at = new Date().toISOString();
    }

    if (nextStatus === "completed") {
      updates.completed_at = new Date().toISOString();
    }

    // Moving away from completed: clear completed_at (it's no
    // longer accurate) but keep started_at — the task genuinely
    // was started at that earlier time.
    if (
      currentStatus === "completed" &&
      nextStatus === "in_progress"
    ) {
      updates.completed_at = null;
    }
  }

  /*
   * Prevent protected fields from being changed by the client.
   */
  if ("id" in updates) delete updates.id;
  if ("organization_id" in updates)
    delete updates.organization_id;
  if ("created_at" in updates) delete updates.created_at;

  const statusChanged =
    updates.status !== undefined &&
    updates.status !== existing.status;

  const updated = await updateCleaningTask(
    organizationId,
    taskId,
    updates
  );

  if (updated && statusChanged) {
    await notifyCleaningStatusChanged(
      organizationId,
      updated,
      updated.status
    );
  }

  return updated;
}

export async function removeCleaningTask(
  organizationId: string,
  taskId: string
) {
  const existing = await findCleaningTaskById(
    organizationId,
    taskId
  );

  if (!existing) {
    return false;
  }

  return deleteCleaningTask(organizationId, taskId);
}
