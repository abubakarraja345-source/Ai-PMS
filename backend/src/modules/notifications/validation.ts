/**
 * Canonical application-level notification_type strings. The
 * database column is free text with no enum/CHECK constraint, so
 * this list is the single source of truth every event-generation
 * call site must use — prevents each module from inventing its
 * own ad hoc type string.
 */
export const NOTIFICATION_TYPES = [
  "reservation_created",
  "reservation_status_changed",
  "cleaning_created",
  "cleaning_status_changed",
  "maintenance_created",
  "maintenance_status_changed",
  "member_role_changed",
  "member_removed",
  "organization_settings_changed",
  "inventory_low_stock",
  "integration_connected",
  "integration_sync_failed",
  "integration_sync_conflict",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

const MAX_TITLE_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 500;

/**
 * Defensive truncation only — these values are always generated
 * server-side from trusted data (never raw client input), so
 * this is a safety cap, not a rejection path.
 */
export function buildNotificationContent(
  title: string,
  message: string,
  notificationType: NotificationType
) {
  return {
    title: title.slice(0, MAX_TITLE_LENGTH),
    message: message.slice(0, MAX_MESSAGE_LENGTH),
    notification_type: notificationType,
  };
}
