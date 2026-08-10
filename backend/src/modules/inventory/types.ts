export interface InventoryItemRow {
  id: string;
  organization_id: string;
  property_id: string;
  item_name: string;
  category: string | null;
  quantity: number;
  minimum_quantity: number;
  unit: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryItemWithPropertyRow extends InventoryItemRow {
  property?: { id: string; title: string } | null;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string | null;
  quantity: number;
  minimumQuantity: number;
  unit: string | null;
  isLowStock: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItemWithProperty extends InventoryItem {
  propertyId: string;
  propertyTitle: string;
}

export interface InventoryTransactionRow {
  id: string;
  inventory_item_id: string;
  quantity: number;
  transaction_type: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface InventoryTransaction {
  id: string;
  quantityChange: number;
  transactionType: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface InventorySummary {
  totalItems: number;
  lowStockItems: number;
  categories: string[];
}
