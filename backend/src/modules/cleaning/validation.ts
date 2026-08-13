import { validateDate } from "../reservations/validation";

/**
 * Confirmed against the live schema (cleaning_tasks.status
 * defaults to 'pending', cleaning_tasks.priority defaults to
 * 'normal' — both plain text columns, no Postgres enum type).
 * No CHECK constraint was discoverable via read-only schema
 * introspection, so these are the values this application
 * enforces at the API layer.
 */
export const CLEANING_STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export const CLEANING_PRIORITIES = [
  "low",
  "normal",
  "high",
  "urgent",
] as const;

export type CleaningStatus = (typeof CLEANING_STATUSES)[number];
export type CleaningPriority =
  (typeof CLEANING_PRIORITIES)[number];

/**
 * Minimum transitions explicitly required, plus completed →
 * in_progress ("moving away from completed should be handled
 * safely" reads as sanctioning this one). cancelled is treated
 * as terminal; no transition out of it. Same-state is always a
 * no-op allow (e.g. re-submitting the current status).
 */
const ALLOWED_TRANSITIONS: Record<
  CleaningStatus,
  CleaningStatus[]
> = {
  pending: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: ["in_progress"],
  cancelled: [],
};

export function isValidStatusTransition(
  from: CleaningStatus,
  to: CleaningStatus
): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

function isCleaningStatus(
  value: string
): value is CleaningStatus {
  return (CLEANING_STATUSES as readonly string[]).includes(
    value
  );
}

function isCleaningPriority(
  value: string
): value is CleaningPriority {
  return (CLEANING_PRIORITIES as readonly string[]).includes(
    value
  );
}

function validateOptionalDate(
  value: unknown,
  fieldName: string
): string | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  return validateDate(value, fieldName);
}

function validateOptionalUuidString(
  value: unknown,
  fieldName: string
): string | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} must be a valid string`);
  }

  return value.trim();
}

export interface CreateCleaningTaskInput {
  property_id: string;
  reservation_id: string | null;
  status: CleaningStatus;
  priority: CleaningPriority;
  scheduled_date: string | null;
  assigned_to: string | null;
  notes: string | null;
}

export function validateCreateCleaningTask(
  input: unknown
): CreateCleaningTaskInput {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid request body");
  }

  const data = input as Record<string, unknown>;

  if (
    typeof data.property_id !== "string" ||
    !data.property_id.trim()
  ) {
    throw new Error("Property is required");
  }

  const reservationId = validateOptionalUuidString(
    data.reservation_id,
    "Reservation"
  );

  let status: CleaningStatus = "pending";

  if (
    data.status !== undefined &&
    data.status !== null &&
    data.status !== ""
  ) {
    if (
      typeof data.status !== "string" ||
      !isCleaningStatus(data.status.trim())
    ) {
      throw new Error(
        `Status must be one of: ${CLEANING_STATUSES.join(", ")}`
      );
    }

    status = data.status.trim() as CleaningStatus;
  }

  let priority: CleaningPriority = "normal";

  if (
    data.priority !== undefined &&
    data.priority !== null &&
    data.priority !== ""
  ) {
    if (
      typeof data.priority !== "string" ||
      !isCleaningPriority(data.priority.trim())
    ) {
      throw new Error(
        `Priority must be one of: ${CLEANING_PRIORITIES.join(", ")}`
      );
    }

    priority = data.priority.trim() as CleaningPriority;
  }

  const scheduledDate = validateOptionalDate(
    data.scheduled_date,
    "Scheduled date"
  );

  const assignedTo = validateOptionalUuidString(
    data.assigned_to,
    "Assigned to"
  );

  const notes =
    typeof data.notes === "string"
      ? data.notes.trim() || null
      : null;

  return {
    property_id: data.property_id.trim(),
    reservation_id: reservationId,
    status,
    priority,
    scheduled_date: scheduledDate,
    assigned_to: assignedTo,
    notes,
  };
}

/**
 * Allowlist-based PATCH validation, matching the properties
 * module's pattern: only known-safe fields survive, each
 * type-checked when supplied. started_at/completed_at are
 * intentionally excluded — they're system-managed side effects
 * of status transitions (see service.ts), not directly editable.
 */
export function validateUpdateCleaningTask(
  input: unknown
): Record<string, unknown> {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid request body");
  }

  const data = input as Record<string, unknown>;
  const updates: Record<string, unknown> = {};

  if (data.property_id !== undefined) {
    if (
      typeof data.property_id !== "string" ||
      !data.property_id.trim()
    ) {
      throw new Error("Property is required");
    }

    updates.property_id = data.property_id.trim();
  }

  if (data.reservation_id !== undefined) {
    updates.reservation_id = validateOptionalUuidString(
      data.reservation_id,
      "Reservation"
    );
  }

  if (data.status !== undefined) {
    if (
      typeof data.status !== "string" ||
      !isCleaningStatus(data.status.trim())
    ) {
      throw new Error(
        `Status must be one of: ${CLEANING_STATUSES.join(", ")}`
      );
    }

    updates.status = data.status.trim();
  }

  if (data.priority !== undefined) {
    if (
      typeof data.priority !== "string" ||
      !isCleaningPriority(data.priority.trim())
    ) {
      throw new Error(
        `Priority must be one of: ${CLEANING_PRIORITIES.join(", ")}`
      );
    }

    updates.priority = data.priority.trim();
  }

  if (data.scheduled_date !== undefined) {
    updates.scheduled_date = validateOptionalDate(
      data.scheduled_date,
      "Scheduled date"
    );
  }

  if (data.assigned_to !== undefined) {
    updates.assigned_to = validateOptionalUuidString(
      data.assigned_to,
      "Assigned to"
    );
  }

  if (data.notes !== undefined) {
    updates.notes =
      typeof data.notes === "string"
        ? data.notes.trim() || null
        : null;
  }

  if (Object.keys(updates).length === 0) {
    throw new Error("No valid fields provided to update");
  }

  return updates;
}

export interface CleaningTaskFilters {
  propertyId?: string;
  status?: CleaningStatus;
  priority?: CleaningPriority;
  scheduledDate?: string;
  start?: string;
  end?: string;
  assignedTo?: string;
  /** Phase 7.4 — server-set only, never client input. */
  propertyIds?: string[];
}

/**
 * Validates GET /api/cleaning query params. Every filter is
 * optional; anything supplied must be well-formed.
 */
export function validateCleaningFilters(
  query: Record<string, unknown>
): CleaningTaskFilters {
  const filters: CleaningTaskFilters = {};

  if (
    query.property_id !== undefined &&
    query.property_id !== ""
  ) {
    if (
      typeof query.property_id !== "string" ||
      !query.property_id.trim()
    ) {
      throw new Error("property_id must be a valid string");
    }

    filters.propertyId = query.property_id.trim();
  }

  if (query.status !== undefined && query.status !== "") {
    if (
      typeof query.status !== "string" ||
      !isCleaningStatus(query.status.trim())
    ) {
      throw new Error(
        `status must be one of: ${CLEANING_STATUSES.join(", ")}`
      );
    }

    filters.status = query.status.trim() as CleaningStatus;
  }

  if (query.priority !== undefined && query.priority !== "") {
    if (
      typeof query.priority !== "string" ||
      !isCleaningPriority(query.priority.trim())
    ) {
      throw new Error(
        `priority must be one of: ${CLEANING_PRIORITIES.join(", ")}`
      );
    }

    filters.priority = query.priority.trim() as CleaningPriority;
  }

  if (
    query.scheduled_date !== undefined &&
    query.scheduled_date !== ""
  ) {
    filters.scheduledDate = validateDate(
      query.scheduled_date,
      "scheduled_date"
    );
  }

  if (query.start !== undefined && query.start !== "") {
    filters.start = validateDate(query.start, "start");
  }

  if (query.end !== undefined && query.end !== "") {
    filters.end = validateDate(query.end, "end");
  }

  if (
    query.assigned_to !== undefined &&
    query.assigned_to !== ""
  ) {
    if (
      typeof query.assigned_to !== "string" ||
      !query.assigned_to.trim()
    ) {
      throw new Error("assigned_to must be a valid string");
    }

    filters.assignedTo = query.assigned_to.trim();
  }

  return filters;
}
