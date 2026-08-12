import { AuditLogFilters } from "./repository";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "./types";

export function validateAuditLogFilters(
  query: Record<string, unknown>
): AuditLogFilters {
  const filters: AuditLogFilters = {};

  if (query.actor_user_id !== undefined && query.actor_user_id !== "") {
    if (typeof query.actor_user_id !== "string") {
      throw new Error("actor_user_id must be a string");
    }
    filters.actorUserId = query.actor_user_id;
  }

  if (query.entity_type !== undefined && query.entity_type !== "") {
    if (
      typeof query.entity_type !== "string" ||
      !AUDIT_ENTITY_TYPES.includes(
        query.entity_type as (typeof AUDIT_ENTITY_TYPES)[number]
      )
    ) {
      throw new Error(
        `entity_type must be one of: ${AUDIT_ENTITY_TYPES.join(", ")}`
      );
    }
    filters.entityType = query.entity_type;
  }

  if (query.entity_id !== undefined && query.entity_id !== "") {
    if (typeof query.entity_id !== "string") {
      throw new Error("entity_id must be a string");
    }
    filters.entityId = query.entity_id;
  }

  if (query.action !== undefined && query.action !== "") {
    if (
      typeof query.action !== "string" ||
      !AUDIT_ACTIONS.includes(query.action as (typeof AUDIT_ACTIONS)[number])
    ) {
      throw new Error(`action must be one of: ${AUDIT_ACTIONS.join(", ")}`);
    }
    filters.action = query.action;
  }

  if (query.start !== undefined && query.start !== "") {
    if (typeof query.start !== "string") {
      throw new Error("start must be a valid date string");
    }
    filters.start = query.start;
  }

  if (query.end !== undefined && query.end !== "") {
    if (typeof query.end !== "string") {
      throw new Error("end must be a valid date string");
    }
    filters.end = query.end;
  }

  return filters;
}
