/**
 * Confirmed business rules (no discoverable evidence existed
 * in schema/code/data — status defaults to 'open' and priority
 * to 'medium' in the live schema, but the full sets were
 * explicitly decided and approved before implementation, not
 * inferred).
 */
export const MAINTENANCE_STATUSES = [
  "open",
  "in_progress",
  "resolved",
  "closed",
  "cancelled",
] as const;

export const MAINTENANCE_PRIORITIES = [
  "low",
  "medium",
  "high",
  "urgent",
] as const;

export type MaintenanceStatus =
  (typeof MAINTENANCE_STATUSES)[number];
export type MaintenancePriority =
  (typeof MAINTENANCE_PRIORITIES)[number];

const ALLOWED_TRANSITIONS: Record<
  MaintenanceStatus,
  MaintenanceStatus[]
> = {
  open: ["in_progress", "cancelled"],
  in_progress: ["resolved", "cancelled"],
  resolved: ["closed", "in_progress"],
  closed: [],
  cancelled: [],
};

export function isValidStatusTransition(
  from: MaintenanceStatus,
  to: MaintenanceStatus
): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

function isMaintenanceStatus(
  value: string
): value is MaintenanceStatus {
  return (MAINTENANCE_STATUSES as readonly string[]).includes(
    value
  );
}

function isMaintenancePriority(
  value: string
): value is MaintenancePriority {
  return (
    MAINTENANCE_PRIORITIES as readonly string[]
  ).includes(value);
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

function validateOptionalCost(
  value: unknown,
  fieldName: string
): number | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${fieldName} must be a valid number`);
  }

  if (value < 0) {
    throw new Error(`${fieldName} cannot be negative`);
  }

  return value;
}

export interface CreateMaintenanceTicketInput {
  property_id: string;
  reservation_id: string | null;
  assigned_to: string | null;
  category: string | null;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  title: string;
  description: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
}

export function validateCreateMaintenanceTicket(
  input: unknown
): CreateMaintenanceTicketInput {
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

  if (
    typeof data.title !== "string" ||
    !data.title.trim()
  ) {
    throw new Error("Title is required");
  }

  const reservationId = validateOptionalUuidString(
    data.reservation_id,
    "Reservation"
  );

  const assignedTo = validateOptionalUuidString(
    data.assigned_to,
    "Assigned to"
  );

  let status: MaintenanceStatus = "open";

  if (
    data.status !== undefined &&
    data.status !== null &&
    data.status !== ""
  ) {
    if (
      typeof data.status !== "string" ||
      !isMaintenanceStatus(data.status.trim())
    ) {
      throw new Error(
        `Status must be one of: ${MAINTENANCE_STATUSES.join(", ")}`
      );
    }

    status = data.status.trim() as MaintenanceStatus;
  }

  let priority: MaintenancePriority = "medium";

  if (
    data.priority !== undefined &&
    data.priority !== null &&
    data.priority !== ""
  ) {
    if (
      typeof data.priority !== "string" ||
      !isMaintenancePriority(data.priority.trim())
    ) {
      throw new Error(
        `Priority must be one of: ${MAINTENANCE_PRIORITIES.join(", ")}`
      );
    }

    priority = data.priority.trim() as MaintenancePriority;
  }

  const category =
    typeof data.category === "string"
      ? data.category.trim() || null
      : null;

  const description =
    typeof data.description === "string"
      ? data.description.trim() || null
      : null;

  const estimatedCost = validateOptionalCost(
    data.estimated_cost,
    "Estimated cost"
  );

  const actualCost = validateOptionalCost(
    data.actual_cost,
    "Actual cost"
  );

  return {
    property_id: data.property_id.trim(),
    reservation_id: reservationId,
    assigned_to: assignedTo,
    category,
    priority,
    status,
    title: data.title.trim(),
    description,
    estimated_cost: estimatedCost,
    actual_cost: actualCost,
  };
}

/**
 * Allowlist-based PATCH validation, matching the
 * Properties/Cleaning pattern: only known-safe fields survive.
 * reported_by, opened_at, and resolved_at are intentionally
 * excluded — reported_by is derived server-side from the
 * authenticated user and never client-editable; the timestamps
 * are system-managed side effects of status transitions.
 */
export function validateUpdateMaintenanceTicket(
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

  if (data.assigned_to !== undefined) {
    updates.assigned_to = validateOptionalUuidString(
      data.assigned_to,
      "Assigned to"
    );
  }

  if (data.title !== undefined) {
    if (
      typeof data.title !== "string" ||
      !data.title.trim()
    ) {
      throw new Error("Title cannot be empty");
    }

    updates.title = data.title.trim();
  }

  if (data.category !== undefined) {
    updates.category =
      typeof data.category === "string"
        ? data.category.trim() || null
        : null;
  }

  if (data.description !== undefined) {
    updates.description =
      typeof data.description === "string"
        ? data.description.trim() || null
        : null;
  }

  if (data.priority !== undefined) {
    if (
      typeof data.priority !== "string" ||
      !isMaintenancePriority(data.priority.trim())
    ) {
      throw new Error(
        `Priority must be one of: ${MAINTENANCE_PRIORITIES.join(", ")}`
      );
    }

    updates.priority = data.priority.trim();
  }

  if (data.status !== undefined) {
    if (
      typeof data.status !== "string" ||
      !isMaintenanceStatus(data.status.trim())
    ) {
      throw new Error(
        `Status must be one of: ${MAINTENANCE_STATUSES.join(", ")}`
      );
    }

    updates.status = data.status.trim();
  }

  if (data.estimated_cost !== undefined) {
    updates.estimated_cost = validateOptionalCost(
      data.estimated_cost,
      "Estimated cost"
    );
  }

  if (data.actual_cost !== undefined) {
    updates.actual_cost = validateOptionalCost(
      data.actual_cost,
      "Actual cost"
    );
  }

  if (Object.keys(updates).length === 0) {
    throw new Error("No valid fields provided to update");
  }

  return updates;
}

export interface MaintenanceTicketFilters {
  propertyId?: string;
  reservationId?: string;
  status?: MaintenanceStatus;
  priority?: MaintenancePriority;
  category?: string;
  assignedTo?: string;
  /** Phase 7.4 — server-set only, never client input. */
  propertyIds?: string[];
}

export function validateMaintenanceFilters(
  query: Record<string, unknown>
): MaintenanceTicketFilters {
  const filters: MaintenanceTicketFilters = {};

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

  if (
    query.reservation_id !== undefined &&
    query.reservation_id !== ""
  ) {
    if (
      typeof query.reservation_id !== "string" ||
      !query.reservation_id.trim()
    ) {
      throw new Error(
        "reservation_id must be a valid string"
      );
    }

    filters.reservationId = query.reservation_id.trim();
  }

  if (query.status !== undefined && query.status !== "") {
    if (
      typeof query.status !== "string" ||
      !isMaintenanceStatus(query.status.trim())
    ) {
      throw new Error(
        `status must be one of: ${MAINTENANCE_STATUSES.join(", ")}`
      );
    }

    filters.status = query.status.trim() as MaintenanceStatus;
  }

  if (query.priority !== undefined && query.priority !== "") {
    if (
      typeof query.priority !== "string" ||
      !isMaintenancePriority(query.priority.trim())
    ) {
      throw new Error(
        `priority must be one of: ${MAINTENANCE_PRIORITIES.join(", ")}`
      );
    }

    filters.priority =
      query.priority.trim() as MaintenancePriority;
  }

  if (query.category !== undefined && query.category !== "") {
    if (typeof query.category !== "string") {
      throw new Error("category must be a valid string");
    }

    filters.category = query.category.trim();
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
