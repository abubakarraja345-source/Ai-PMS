export interface AuditLogRow {
  id: string;
  organization_id: string;
  actor_user_id: string | null;
  actor_label: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/**
 * The curated set of "important actions" this module records — see
 * the migration's own header comment for why this is intentionally
 * not an exhaustive wrap of every mutation in the app.
 */
export const AUDIT_ACTIONS = [
  "reservation.created",
  "reservation.cancelled",
  "reservation.review_cleared",
  "member.role_changed",
  "member.removed",
  "invitation.created",
  "invitation.resent",
  "invitation.revoked",
  "integration.connected",
  "currency.organization_changed",
  "currency.property_changed",
  "airbnb.connection_started",
  "airbnb.connection_authorized",
  "airbnb.connection_failed",
  "airbnb.disconnected",
  "airbnb.listing_mapped",
  "airbnb.listing_unmapped",
  "airbnb.property_created_from_listing",
  "airbnb.reservation_merged_from_ical",
  "message.conversation_linked",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ENTITY_TYPES = [
  "reservation",
  "member",
  "invitation",
  "integration",
  "organization",
  "property",
  "guest",
] as const;

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];
