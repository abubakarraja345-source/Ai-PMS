export interface CreateInventoryItemInput {
  name: string;
  category: string | null;
  unit: string | null;
  minimumQuantity: number;
  initialQuantity: number;
}

export function validateCreateInventoryItem(
  input: unknown
): CreateInventoryItemInput {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid request body");
  }

  const data = input as Record<string, unknown>;

  if (typeof data.name !== "string" || !data.name.trim()) {
    throw new Error("Item name is required");
  }

  if (
    data.category !== undefined &&
    data.category !== null &&
    typeof data.category !== "string"
  ) {
    throw new Error("category must be a string or null");
  }

  if (
    data.unit !== undefined &&
    data.unit !== null &&
    typeof data.unit !== "string"
  ) {
    throw new Error("unit must be a string or null");
  }

  const minimumQuantity = validateNonNegativeInteger(
    data.minimumQuantity,
    "minimumQuantity",
    0
  );

  const initialQuantity = validateNonNegativeInteger(
    data.initialQuantity,
    "initialQuantity",
    0
  );

  return {
    name: data.name.trim(),
    category:
      typeof data.category === "string"
        ? data.category.trim() || null
        : null,
    unit: typeof data.unit === "string" ? data.unit.trim() || null : null,
    minimumQuantity,
    initialQuantity,
  };
}

export interface UpdateInventoryItemInput {
  name?: string;
  category?: string | null;
  unit?: string | null;
  minimumQuantity?: number;
}

export function validateUpdateInventoryItem(
  input: unknown
): UpdateInventoryItemInput {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid request body");
  }

  const data = input as Record<string, unknown>;
  const updates: UpdateInventoryItemInput = {};

  if (data.name !== undefined) {
    if (typeof data.name !== "string" || !data.name.trim()) {
      throw new Error("Item name cannot be empty");
    }

    updates.name = data.name.trim();
  }

  if (data.category !== undefined) {
    if (data.category !== null && typeof data.category !== "string") {
      throw new Error("category must be a string or null");
    }

    updates.category =
      typeof data.category === "string"
        ? data.category.trim() || null
        : null;
  }

  if (data.unit !== undefined) {
    if (data.unit !== null && typeof data.unit !== "string") {
      throw new Error("unit must be a string or null");
    }

    updates.unit =
      typeof data.unit === "string" ? data.unit.trim() || null : null;
  }

  if (data.minimumQuantity !== undefined) {
    updates.minimumQuantity = validateNonNegativeInteger(
      data.minimumQuantity,
      "minimumQuantity"
    );
  }

  if (Object.keys(updates).length === 0) {
    throw new Error("No valid fields provided to update");
  }

  return updates;
}

export interface AdjustInventoryInput {
  quantityChange: number;
  reason: string | null;
  notes: string | null;
}

export function validateAdjustInventory(input: unknown): AdjustInventoryInput {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid request body");
  }

  const data = input as Record<string, unknown>;

  if (
    typeof data.quantityChange !== "number" ||
    !Number.isFinite(data.quantityChange) ||
    !Number.isInteger(data.quantityChange)
  ) {
    throw new Error("quantityChange must be a whole number");
  }

  if (data.quantityChange === 0) {
    throw new Error("quantityChange cannot be zero");
  }

  if (
    data.reason !== undefined &&
    data.reason !== null &&
    typeof data.reason !== "string"
  ) {
    throw new Error("reason must be a string or null");
  }

  if (
    data.notes !== undefined &&
    data.notes !== null &&
    typeof data.notes !== "string"
  ) {
    throw new Error("notes must be a string or null");
  }

  return {
    quantityChange: data.quantityChange,
    reason:
      typeof data.reason === "string" ? data.reason.trim() || null : null,
    notes: typeof data.notes === "string" ? data.notes.trim() || null : null,
  };
}

export interface InventoryFilters {
  category?: string;
  lowStockOnly?: boolean;
  search?: string;
  propertyId?: string;
}

export function validateInventoryFilters(
  query: Record<string, unknown>
): InventoryFilters {
  const filters: InventoryFilters = {};

  if (typeof query.category === "string" && query.category.trim()) {
    filters.category = query.category.trim();
  }

  if (query.lowStockOnly === "true") {
    filters.lowStockOnly = true;
  }

  if (typeof query.search === "string" && query.search.trim()) {
    filters.search = query.search.trim();
  }

  if (typeof query.propertyId === "string" && query.propertyId.trim()) {
    filters.propertyId = query.propertyId.trim();
  }

  return filters;
}

function validateNonNegativeInteger(
  value: unknown,
  fieldName: string,
  fallback?: number
): number {
  if (value === undefined && fallback !== undefined) {
    return fallback;
  }

  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value)
  ) {
    throw new Error(`${fieldName} must be a whole number`);
  }

  if (value < 0) {
    throw new Error(`${fieldName} cannot be negative`);
  }

  return value;
}
