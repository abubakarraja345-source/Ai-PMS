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
 * Recipients for an event: every owner/company_admin in the
 * organization, plus (if supplied and it actually belongs to the
 * organization) a specific assignee. Reuses the existing
 * organization/team roster lookup rather than adding a new query —
 * one fetch answers both "who are the admins" and "is this uuid a
 * real member" without a second round trip.
 */
async function resolveRecipients(
  organizationId: string,
  assignedTo?: string | null
): Promise<Set<string>> {
  const members = await findMembersByOrganization(organizationId);
  const recipients = new Set<string>();

  for (const member of members) {
    if (member.role === "owner" || member.role === "company_admin") {
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
