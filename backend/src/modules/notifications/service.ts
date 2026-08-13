import { supabase } from "../../config/supabase";
import { findMembersByOrganization } from "../organization/repository";

import {
  countUnreadForUser,
  deleteNotification,
  findNotificationsForUser,
  insertNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./repository";

import { Notification, NotificationRow } from "./types";
import { buildNotificationContent, NotificationType } from "./validation";

function toClient(row: NotificationRow): Notification {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    notificationType: row.notification_type,
    isRead: row.is_read,
    createdAt: row.created_at,
  };
}

export async function listNotifications(
  organizationId: string,
  userId: string
): Promise<Notification[]> {
  const rows = await findNotificationsForUser(organizationId, userId);
  return rows.map(toClient);
}

export async function getUnreadCount(
  organizationId: string,
  userId: string
): Promise<number> {
  return countUnreadForUser(organizationId, userId);
}

export async function markAsRead(
  organizationId: string,
  userId: string,
  notificationId: string
): Promise<Notification | null> {
  const updated = await markNotificationRead(
    organizationId,
    userId,
    notificationId
  );

  return updated ? toClient(updated) : null;
}

export async function markAllAsRead(
  organizationId: string,
  userId: string
): Promise<number> {
  return markAllNotificationsRead(organizationId, userId);
}

export async function removeNotification(
  organizationId: string,
  userId: string,
  notificationId: string
): Promise<boolean> {
  return deleteNotification(organizationId, userId, notificationId);
}

/* ------------------------------------------------------------------ *
 * Event-generation helpers.
 *
 * Called from other modules' service functions AFTER the underlying
 * business operation has already succeeded. Every helper here swallows
 * its own errors — a failure to notify must never surface as a failure
 * of the reservation/cleaning/maintenance/team/settings operation that
 * triggered it, and there is no existing transactional pattern in this
 * codebase for these separate writes to roll back together anyway.
 * ------------------------------------------------------------------ */

/**
 * Recipients for an event: every owner/company_admin/manager in the
 * organization, plus (if supplied and it actually belongs to the
 * organization) a specific assignee. Reuses the existing
 * organization/team roster lookup rather than adding a new query —
 * one fetch answers both "who are the admins" and "is this uuid a
 * real member" without a second round trip.
 *
 * Phase 7.3 — "manager" added alongside owner/company_admin: Manager
 * now holds approvals.review (can approve/reject pending requests),
 * so it's consistent for them to receive the same org-wide operational
 * notifications the other reviewer-tier roles already get. A
 * deliberate, low-risk default change — noted explicitly in the
 * checkpoint report.
 */
async function resolveRecipients(
  organizationId: string,
  assignedTo?: string | null
): Promise<Set<string>> {
  const members = await findMembersByOrganization(organizationId);
  const recipients = new Set<string>();

  for (const member of members) {
    if (
      member.role === "owner" ||
      member.role === "company_admin" ||
      member.role === "manager"
    ) {
      recipients.add(member.user_id);
    }
  }

  if (assignedTo && members.some((m) => m.user_id === assignedTo)) {
    recipients.add(assignedTo);
  }

  return recipients;
}

async function resolveEmail(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.admin.getUserById(
      userId
    );

    if (error || !data?.user) {
      return null;
    }

    return data.user.email ?? null;
  } catch {
    return null;
  }
}

async function dispatch(
  organizationId: string,
  recipients: Set<string>,
  title: string,
  message: string,
  notificationType: NotificationType
): Promise<void> {
  if (recipients.size === 0) return;

  const content = buildNotificationContent(
    title,
    message,
    notificationType
  );

  await insertNotifications(
    Array.from(recipients).map((userId) => ({
      organization_id: organizationId,
      user_id: userId,
      ...content,
    }))
  );
}

interface ReservationEventData {
  check_in: string;
  check_out: string;
  booking_reference: string | null;
  property?: { title: string } | null;
}

export async function notifyReservationCreated(
  organizationId: string,
  reservation: ReservationEventData
): Promise<void> {
  try {
    const recipients = await resolveRecipients(organizationId);
    const propertyTitle = reservation.property?.title ?? "a property";
    const reference = reservation.booking_reference
      ? ` (Ref: ${reservation.booking_reference})`
      : "";

    await dispatch(
      organizationId,
      recipients,
      "New reservation",
      `New reservation at ${propertyTitle}: ${reservation.check_in} → ${reservation.check_out}${reference}.`,
      "reservation_created"
    );
  } catch (error) {
    console.error("Failed to create reservation_created notification:", error);
  }
}

export async function notifyReservationStatusChanged(
  organizationId: string,
  reservation: ReservationEventData,
  newStatus: string
): Promise<void> {
  try {
    const recipients = await resolveRecipients(organizationId);
    const propertyTitle = reservation.property?.title ?? "a property";

    await dispatch(
      organizationId,
      recipients,
      "Reservation status updated",
      `Reservation at ${propertyTitle} changed to "${newStatus}".`,
      "reservation_status_changed"
    );
  } catch (error) {
    console.error(
      "Failed to create reservation_status_changed notification:",
      error
    );
  }
}

interface CleaningEventData {
  priority: string;
  assigned_to: string | null;
  property?: { title: string } | null;
}

export async function notifyCleaningCreated(
  organizationId: string,
  task: CleaningEventData
): Promise<void> {
  try {
    const recipients = await resolveRecipients(
      organizationId,
      task.assigned_to
    );
    const propertyTitle = task.property?.title ?? "a property";

    await dispatch(
      organizationId,
      recipients,
      "Cleaning task assigned",
      `Cleaning task at ${propertyTitle} (priority: ${task.priority}).`,
      "cleaning_created"
    );
  } catch (error) {
    console.error("Failed to create cleaning_created notification:", error);
  }
}

export async function notifyCleaningStatusChanged(
  organizationId: string,
  task: CleaningEventData,
  newStatus: string
): Promise<void> {
  try {
    const recipients = await resolveRecipients(
      organizationId,
      task.assigned_to
    );
    const propertyTitle = task.property?.title ?? "a property";

    await dispatch(
      organizationId,
      recipients,
      "Cleaning task updated",
      `Cleaning task at ${propertyTitle} changed to "${newStatus}".`,
      "cleaning_status_changed"
    );
  } catch (error) {
    console.error(
      "Failed to create cleaning_status_changed notification:",
      error
    );
  }
}

interface MaintenanceEventData {
  title: string;
  assigned_to: string | null;
  property?: { title: string } | null;
}

export async function notifyMaintenanceCreated(
  organizationId: string,
  ticket: MaintenanceEventData
): Promise<void> {
  try {
    const recipients = await resolveRecipients(
      organizationId,
      ticket.assigned_to
    );
    const propertyTitle = ticket.property?.title ?? "a property";

    await dispatch(
      organizationId,
      recipients,
      "New maintenance ticket",
      `New maintenance ticket "${ticket.title}" at ${propertyTitle}.`,
      "maintenance_created"
    );
  } catch (error) {
    console.error(
      "Failed to create maintenance_created notification:",
      error
    );
  }
}

export async function notifyMaintenanceStatusChanged(
  organizationId: string,
  ticket: MaintenanceEventData,
  newStatus: string
): Promise<void> {
  try {
    const recipients = await resolveRecipients(
      organizationId,
      ticket.assigned_to
    );

    await dispatch(
      organizationId,
      recipients,
      "Maintenance ticket updated",
      `Maintenance ticket "${ticket.title}" changed to "${newStatus}".`,
      "maintenance_status_changed"
    );
  } catch (error) {
    console.error(
      "Failed to create maintenance_status_changed notification:",
      error
    );
  }
}

export async function notifyMemberRoleChanged(
  organizationId: string,
  targetUserId: string,
  newRole: string
): Promise<void> {
  try {
    const recipients = await resolveRecipients(organizationId);
    const email = await resolveEmail(targetUserId);

    await dispatch(
      organizationId,
      recipients,
      "Team member role changed",
      `${email ?? "A team member"}'s role was changed to "${newRole}".`,
      "member_role_changed"
    );
  } catch (error) {
    console.error(
      "Failed to create member_role_changed notification:",
      error
    );
  }
}

export async function notifyMemberRemoved(
  organizationId: string,
  removedUserId: string
): Promise<void> {
  try {
    const recipients = await resolveRecipients(organizationId);
    const email = await resolveEmail(removedUserId);

    await dispatch(
      organizationId,
      recipients,
      "Team member removed",
      `${email ?? "A team member"} was removed from the organization.`,
      "member_removed"
    );
  } catch (error) {
    console.error("Failed to create member_removed notification:", error);
  }
}

interface InventoryLowStockEventData {
  itemName: string;
  quantity: number;
  minimumQuantity: number;
  unit: string | null;
  propertyTitle: string;
}

export async function notifyInventoryLowStock(
  organizationId: string,
  item: InventoryLowStockEventData
): Promise<void> {
  try {
    const recipients = await resolveRecipients(organizationId);
    const unitLabel = item.unit ? ` ${item.unit}` : "";

    await dispatch(
      organizationId,
      recipients,
      "Low stock alert",
      `${item.itemName} at ${item.propertyTitle} is low on stock (${item.quantity}${unitLabel} remaining, minimum ${item.minimumQuantity}${unitLabel}).`,
      "inventory_low_stock"
    );
  } catch (error) {
    console.error("Failed to create inventory_low_stock notification:", error);
  }
}

interface IntegrationEventData {
  provider: string;
  accountName: string | null;
}

function integrationLabel(data: IntegrationEventData): string {
  return data.accountName ? `${data.provider} (${data.accountName})` : data.provider;
}

export async function notifyIntegrationConnected(
  organizationId: string,
  data: IntegrationEventData
): Promise<void> {
  try {
    const recipients = await resolveRecipients(organizationId);

    await dispatch(
      organizationId,
      recipients,
      "Integration connected",
      `${integrationLabel(data)} connected successfully.`,
      "integration_connected"
    );
  } catch (error) {
    console.error("Failed to create integration_connected notification:", error);
  }
}

export async function notifyIntegrationSyncFailed(
  organizationId: string,
  data: IntegrationEventData & { errorMessage: string }
): Promise<void> {
  try {
    const recipients = await resolveRecipients(organizationId);

    await dispatch(
      organizationId,
      recipients,
      "Integration sync failed",
      `${integrationLabel(data)} failed: ${data.errorMessage}`,
      "integration_sync_failed"
    );
  } catch (error) {
    console.error("Failed to create integration_sync_failed notification:", error);
  }
}

/**
 * Fires once when a connection goes from failing back to a
 * successful sync — the counterpart to notifyIntegrationSyncFailed's
 * "only on the first failure" gate. Callers must only invoke this
 * when the previous consecutive-failure count was actually > 0, so
 * this never fires on every routine successful sync.
 */
export async function notifyIntegrationSyncRecovered(
  organizationId: string,
  data: IntegrationEventData
): Promise<void> {
  try {
    const recipients = await resolveRecipients(organizationId);

    await dispatch(
      organizationId,
      recipients,
      "Connection recovered",
      `${integrationLabel(data)} is syncing successfully again.`,
      "integration_sync_recovered"
    );
  } catch (error) {
    console.error("Failed to create integration_sync_recovered notification:", error);
  }
}

/**
 * A single escalation notice once a connection crosses a "this has
 * been failing for a while" threshold — deliberately separate from
 * notifyIntegrationSyncFailed's first-failure notice, and gated by
 * the caller to fire exactly once per failure streak (not on every
 * failure past the threshold), so a feed that's been down for hours
 * doesn't produce a notification every 30 minutes.
 */
export async function notifyIntegrationSyncEscalation(
  organizationId: string,
  data: IntegrationEventData & { consecutiveFailureCount: number }
): Promise<void> {
  try {
    const recipients = await resolveRecipients(organizationId);

    await dispatch(
      organizationId,
      recipients,
      "Integration still failing",
      `${integrationLabel(data)} has failed to sync ${data.consecutiveFailureCount} times in a row. Check the connection.`,
      "integration_sync_escalation"
    );
  } catch (error) {
    console.error("Failed to create integration_sync_escalation notification:", error);
  }
}

export async function notifyIntegrationSyncConflict(
  organizationId: string,
  data: IntegrationEventData & { conflictCount: number }
): Promise<void> {
  try {
    const recipients = await resolveRecipients(organizationId);

    await dispatch(
      organizationId,
      recipients,
      "Integration sync conflict",
      `${integrationLabel(data)} sync found ${data.conflictCount} reservation(s) that overlap an existing booking — imported and flagged for your review.`,
      "integration_sync_conflict"
    );
  } catch (error) {
    console.error("Failed to create integration_sync_conflict notification:", error);
  }
}

function humanizeResourceAction(resourceAction: string): string {
  return resourceAction
    .split(",")
    .map((a) => a.split(".")[1]?.replace(/_/g, " ") ?? a)
    .join(", ");
}

interface ApprovalRequestedEventData {
  requesterLabel: string;
  entityType: string;
  resourceAction: string;
}

/** Recipients = reviewers (owner/company_admin/manager), via the same
 * resolveRecipients() every other org-wide event uses — a new
 * approval request needs the reviewers' attention, not the
 * requester's own. */
export async function notifyApprovalRequested(
  organizationId: string,
  data: ApprovalRequestedEventData
): Promise<void> {
  try {
    const recipients = await resolveRecipients(organizationId);

    await dispatch(
      organizationId,
      recipients,
      "Approval requested",
      `${data.requesterLabel} requested approval to change ${humanizeResourceAction(data.resourceAction)} on a ${data.entityType}.`,
      "approval_requested"
    );
  } catch (error) {
    console.error("Failed to create approval_requested notification:", error);
  }
}

interface ApprovalDecisionEventData {
  requestedBy: string;
  entityType: string;
  resourceAction: string;
}

/** Recipient = the original requester specifically, not the reviewer
 * group — "did MY change get approved" is personal, not org-wide. */
export async function notifyApprovalApproved(
  organizationId: string,
  data: ApprovalDecisionEventData
): Promise<void> {
  try {
    await dispatch(
      organizationId,
      new Set([data.requestedBy]),
      "Your change was approved",
      `Your requested change to ${humanizeResourceAction(data.resourceAction)} on a ${data.entityType} was approved and applied.`,
      "approval_approved"
    );
  } catch (error) {
    console.error("Failed to create approval_approved notification:", error);
  }
}

export async function notifyApprovalRejected(
  organizationId: string,
  data: ApprovalDecisionEventData
): Promise<void> {
  try {
    await dispatch(
      organizationId,
      new Set([data.requestedBy]),
      "Your change was rejected",
      `Your requested change to ${humanizeResourceAction(data.resourceAction)} on a ${data.entityType} was rejected.`,
      "approval_rejected"
    );
  } catch (error) {
    console.error("Failed to create approval_rejected notification:", error);
  }
}

function humanizeFieldName(field: string): string {
  return field.replace(/_/g, " ");
}

export async function notifySettingsChanged(
  organizationId: string,
  changedFields: string[]
): Promise<void> {
  try {
    if (changedFields.length === 0) return;

    const recipients = await resolveRecipients(organizationId);
    const fieldList = changedFields.map(humanizeFieldName).join(", ");

    await dispatch(
      organizationId,
      recipients,
      "Organization settings updated",
      `Updated: ${fieldList}.`,
      "organization_settings_changed"
    );
  } catch (error) {
    console.error(
      "Failed to create organization_settings_changed notification:",
      error
    );
  }
}
