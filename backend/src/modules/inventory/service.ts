import { verifyProperty } from "../reservations/service";
import { findPropertyById } from "../properties/repository";
import { notifyInventoryLowStock } from "../notifications/service";

import {
  createItemRow,
  createTransactionRow,
  deleteItemRow,
  deleteTransactionsByItem,
  findItemById,
  findItemByNameInProperty,
  findItemsByOrganization,
  findItemsByProperty,
  findTransactionsByItem,
  updateItemRow,
} from "./repository";

import {
  InventoryItem,
  InventoryItemRow,
  InventoryItemWithProperty,
  InventoryItemWithPropertyRow,
  InventorySummary,
  InventoryTransaction,
  InventoryTransactionRow,
} from "./types";

import {
  AdjustInventoryInput,
  CreateInventoryItemInput,
  InventoryFilters,
  UpdateInventoryItemInput,
} from "./validation";

async function assertPropertyInOrganization(
  organizationId: string,
  propertyId: string
): Promise<void> {
  const exists = await verifyProperty(organizationId, propertyId);

  if (!exists) {
    throw new Error("Property not found in your organization");
  }
}

function toClientItem(row: InventoryItemRow): InventoryItem {
  return {
    id: row.id,
    name: row.item_name,
    category: row.category,
    quantity: row.quantity,
    minimumQuantity: row.minimum_quantity,
    unit: row.unit,
    isLowStock: row.quantity <= row.minimum_quantity,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toClientItemWithProperty(
  row: InventoryItemWithPropertyRow
): InventoryItemWithProperty {
  return {
    ...toClientItem(row),
    propertyId: row.property_id,
    propertyTitle: row.property?.title ?? "Unknown property",
  };
}

function toClientTransaction(
  row: InventoryTransactionRow
): InventoryTransaction {
  return {
    id: row.id,
    quantityChange: row.quantity,
    transactionType: row.transaction_type,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function applyFilters(
  items: InventoryItem[],
  filters: InventoryFilters
): InventoryItem[] {
  let result = items;

  if (filters.category) {
    result = result.filter(
      (item) =>
        item.category?.toLowerCase() === filters.category!.toLowerCase()
    );
  }

  if (filters.lowStockOnly) {
    result = result.filter((item) => item.isLowStock);
  }

  if (filters.search) {
    const term = filters.search.toLowerCase();
    result = result.filter((item) => item.name.toLowerCase().includes(term));
  }

  return result;
}

export async function listInventoryForProperty(
  organizationId: string,
  propertyId: string,
  filters: InventoryFilters
): Promise<InventoryItem[]> {
  await assertPropertyInOrganization(organizationId, propertyId);

  const rows = await findItemsByProperty(propertyId);

  return applyFilters(rows.map(toClientItem), filters);
}

export async function listInventoryForOrganization(
  organizationId: string,
  filters: InventoryFilters
): Promise<InventoryItemWithProperty[]> {
  const rows = await findItemsByOrganization(organizationId);

  let items = rows.map(toClientItemWithProperty);

  if (filters.propertyId) {
    items = items.filter((item) => item.propertyId === filters.propertyId);
  }

  return applyFilters(items, filters) as InventoryItemWithProperty[];
}

export async function getInventorySummary(
  organizationId: string
): Promise<InventorySummary> {
  const rows = await findItemsByOrganization(organizationId);
  const items = rows.map(toClientItem);

  const categories = Array.from(
    new Set(
      items
        .map((item) => item.category)
        .filter((category): category is string => !!category)
    )
  ).sort();

  return {
    totalItems: items.length,
    lowStockItems: items.filter((item) => item.isLowStock).length,
    categories,
  };
}

export async function getInventoryItem(
  organizationId: string,
  propertyId: string,
  itemId: string
): Promise<InventoryItem | null> {
  await assertPropertyInOrganization(organizationId, propertyId);

  const row = await findItemById(propertyId, itemId);

  return row ? toClientItem(row) : null;
}

export async function addInventoryItem(
  organizationId: string,
  propertyId: string,
  userId: string,
  input: CreateInventoryItemInput
): Promise<InventoryItem> {
  await assertPropertyInOrganization(organizationId, propertyId);

  const duplicate = await findItemByNameInProperty(propertyId, input.name);

  if (duplicate) {
    throw new Error(
      `An inventory item named "${input.name}" already exists for this property`
    );
  }

  const row = await createItemRow(organizationId, propertyId, {
    name: input.name,
    category: input.category,
    unit: input.unit,
    minimumQuantity: input.minimumQuantity,
    initialQuantity: input.initialQuantity,
  });

  if (input.initialQuantity > 0) {
    await createTransactionRow(row.id, {
      quantity: input.initialQuantity,
      transactionType: "initial_stock",
      notes: null,
      createdBy: userId,
    });
  }

  return toClientItem(row);
}

export async function editInventoryItem(
  organizationId: string,
  propertyId: string,
  itemId: string,
  updates: UpdateInventoryItemInput
): Promise<InventoryItem | null> {
  await assertPropertyInOrganization(organizationId, propertyId);

  const existing = await findItemById(propertyId, itemId);

  if (!existing) {
    return null;
  }

  if (updates.name !== undefined) {
    const duplicate = await findItemByNameInProperty(
      propertyId,
      updates.name,
      itemId
    );

    if (duplicate) {
      throw new Error(
        `An inventory item named "${updates.name}" already exists for this property`
      );
    }
  }

  const dbUpdates: Record<string, unknown> = {};

  if (updates.name !== undefined) dbUpdates.item_name = updates.name;
  if (updates.category !== undefined) dbUpdates.category = updates.category;
  if (updates.unit !== undefined) dbUpdates.unit = updates.unit;
  if (updates.minimumQuantity !== undefined)
    dbUpdates.minimum_quantity = updates.minimumQuantity;

  const updated = await updateItemRow(propertyId, itemId, dbUpdates);

  return updated ? toClientItem(updated) : null;
}

export async function removeInventoryItem(
  organizationId: string,
  propertyId: string,
  itemId: string
): Promise<boolean> {
  await assertPropertyInOrganization(organizationId, propertyId);

  const existing = await findItemById(propertyId, itemId);

  if (!existing) {
    return false;
  }

  await deleteTransactionsByItem(itemId);

  return deleteItemRow(propertyId, itemId);
}

/**
 * Applies a signed quantity change, prevents negative stock, and
 * fires a low-stock notification only on the transition from above
 * the threshold to at/below it — never repeatedly while an item
 * remains low, per the approved rule:
 *   previousQuantity > minimumQuantity AND newQuantity <= minimumQuantity
 */
export async function adjustInventoryStock(
  organizationId: string,
  propertyId: string,
  itemId: string,
  userId: string,
  input: AdjustInventoryInput
): Promise<InventoryItem | null> {
  await assertPropertyInOrganization(organizationId, propertyId);

  const existing = await findItemById(propertyId, itemId);

  if (!existing) {
    return null;
  }

  const previousQuantity = existing.quantity;
  const newQuantity = previousQuantity + input.quantityChange;

  if (newQuantity < 0) {
    throw new Error(
      `Insufficient stock: ${existing.item_name} only has ${previousQuantity} available`
    );
  }

  const updated = await updateItemRow(propertyId, itemId, {
    quantity: newQuantity,
  });

  if (!updated) {
    return null;
  }

  await createTransactionRow(itemId, {
    quantity: input.quantityChange,
    transactionType: input.reason,
    notes: input.notes,
    createdBy: userId,
  });

  const crossedIntoLowStock =
    previousQuantity > updated.minimum_quantity &&
    newQuantity <= updated.minimum_quantity;

  if (crossedIntoLowStock) {
    const property = await findPropertyById(organizationId, propertyId);

    await notifyInventoryLowStock(organizationId, {
      itemName: updated.item_name,
      quantity: newQuantity,
      minimumQuantity: updated.minimum_quantity,
      unit: updated.unit,
      propertyTitle: property?.title ?? "a property",
    });
  }

  return toClientItem(updated);
}

export async function getInventoryHistory(
  organizationId: string,
  propertyId: string,
  itemId: string
): Promise<InventoryTransaction[] | null> {
  await assertPropertyInOrganization(organizationId, propertyId);

  const item = await findItemById(propertyId, itemId);

  if (!item) {
    return null;
  }

  const rows = await findTransactionsByItem(itemId);

  return rows.map(toClientTransaction);
}
