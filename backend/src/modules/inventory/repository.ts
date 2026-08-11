import { supabase } from "../../config/supabase";
import {
  InventoryItemRow,
  InventoryItemWithPropertyRow,
  InventoryTransactionRow,
} from "./types";

const ITEM_SELECT =
  "id, organization_id, property_id, item_name, category, quantity, minimum_quantity, unit, created_at, updated_at";

const ITEM_WITH_PROPERTY_SELECT = `
  id, organization_id, property_id, item_name, category, quantity, minimum_quantity, unit, created_at, updated_at,
  property:properties(id, title)
`;

export interface InventoryQueryFilters {
  category?: string;
  search?: string;
}

export async function findItemsByProperty(
  propertyId: string,
  filters: InventoryQueryFilters = {},
  range?: { from: number; to: number }
): Promise<{ data: InventoryItemRow[]; total: number }> {
  let query = supabase
    .from("inventory_items")
    .select(ITEM_SELECT, { count: "exact" })
    .eq("property_id", propertyId);

  if (filters.category) {
    query = query.eq("category", filters.category);
  }

  if (filters.search) {
    query = query.ilike("item_name", `%${filters.search}%`);
  }

  query = query.order("item_name", { ascending: true });

  if (range) {
    query = query.range(range.from, range.to);
  }

  const { data, error, count } = await query;

  if (error) throw error;

  return { data: data ?? [], total: count ?? 0 };
}

export async function findItemsByOrganization(
  organizationId: string,
  filters: InventoryQueryFilters = {},
  range?: { from: number; to: number }
): Promise<{ data: InventoryItemWithPropertyRow[]; total: number }> {
  let query = supabase
    .from("inventory_items")
    .select(ITEM_WITH_PROPERTY_SELECT, { count: "exact" })
    .eq("organization_id", organizationId);

  if (filters.category) {
    query = query.eq("category", filters.category);
  }

  if (filters.search) {
    query = query.ilike("item_name", `%${filters.search}%`);
  }

  query = query.order("item_name", { ascending: true });

  if (range) {
    query = query.range(range.from, range.to);
  }

  const { data, error, count } = await query;

  if (error) throw error;

  return {
    data: (data ?? []) as unknown as InventoryItemWithPropertyRow[],
    total: count ?? 0,
  };
}

export async function findItemById(
  propertyId: string,
  itemId: string
): Promise<InventoryItemRow | null> {
  const { data, error } = await supabase
    .from("inventory_items")
    .select(ITEM_SELECT)
    .eq("id", itemId)
    .eq("property_id", propertyId)
    .maybeSingle();

  if (error) throw error;

  return data;
}

/** Organization-scoped lookup (not property-scoped) — used by the
 * AI action executor, which only knows an item id and must resolve
 * its property itself rather than trusting a client-supplied one. */
export async function findItemByIdForOrganization(
  organizationId: string,
  itemId: string
): Promise<InventoryItemWithPropertyRow | null> {
  const { data, error } = await supabase
    .from("inventory_items")
    .select(ITEM_WITH_PROPERTY_SELECT)
    .eq("id", itemId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) throw error;

  return data as unknown as InventoryItemWithPropertyRow | null;
}

/** Case-insensitive exact-name match within a property, used to
 * prevent silent duplicate items. `ilike` with no wildcards is an
 * exact case-insensitive comparison in Postgres. */
export async function findItemByNameInProperty(
  propertyId: string,
  name: string,
  excludeItemId?: string
): Promise<InventoryItemRow | null> {
  let query = supabase
    .from("inventory_items")
    .select(ITEM_SELECT)
    .eq("property_id", propertyId)
    .ilike("item_name", name);

  if (excludeItemId) {
    query = query.neq("id", excludeItemId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) throw error;

  return data;
}

export async function createItemRow(
  organizationId: string,
  propertyId: string,
  input: {
    name: string;
    category: string | null;
    unit: string | null;
    minimumQuantity: number;
    initialQuantity: number;
  }
): Promise<InventoryItemRow> {
  const { data, error } = await supabase
    .from("inventory_items")
    .insert({
      organization_id: organizationId,
      property_id: propertyId,
      item_name: input.name,
      category: input.category,
      unit: input.unit,
      minimum_quantity: input.minimumQuantity,
      quantity: input.initialQuantity,
    })
    .select(ITEM_SELECT)
    .single();

  if (error) throw error;

  return data;
}

export async function updateItemRow(
  propertyId: string,
  itemId: string,
  updates: Record<string, unknown>
): Promise<InventoryItemRow | null> {
  const { data, error } = await supabase
    .from("inventory_items")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("property_id", propertyId)
    .select(ITEM_SELECT)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function deleteItemRow(
  propertyId: string,
  itemId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("inventory_items")
    .delete()
    .eq("id", itemId)
    .eq("property_id", propertyId)
    .select("id");

  if (error) throw error;

  return !!data && data.length > 0;
}

/* ----------------------------- Transactions ------------------------------ */

const TRANSACTION_SELECT =
  "id, inventory_item_id, quantity, transaction_type, notes, created_by, created_at";

export async function createTransactionRow(
  itemId: string,
  input: {
    quantity: number;
    transactionType: string | null;
    notes: string | null;
    createdBy: string;
  }
): Promise<InventoryTransactionRow> {
  const { data, error } = await supabase
    .from("inventory_transactions")
    .insert({
      inventory_item_id: itemId,
      quantity: input.quantity,
      transaction_type: input.transactionType,
      notes: input.notes,
      created_by: input.createdBy,
    })
    .select(TRANSACTION_SELECT)
    .single();

  if (error) throw error;

  return data;
}

export async function findTransactionsByItem(
  itemId: string
): Promise<InventoryTransactionRow[]> {
  const { data, error } = await supabase
    .from("inventory_transactions")
    .select(TRANSACTION_SELECT)
    .eq("inventory_item_id", itemId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

/** Defensive cleanup before deleting an item — mirrors the
 * property-media/property-details pattern of not relying on
 * unconfirmed cascade behavior. */
export async function deleteTransactionsByItem(
  itemId: string
): Promise<void> {
  const { error } = await supabase
    .from("inventory_transactions")
    .delete()
    .eq("inventory_item_id", itemId);

  if (error) throw error;
}
