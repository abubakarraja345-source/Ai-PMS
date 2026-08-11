"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

interface InventoryItem {
  id: string;
  name: string;
  category: string | null;
  quantity: number;
  minimumQuantity: number;
  unit: string | null;
  isLowStock: boolean;
  propertyId: string;
  propertyTitle: string;
  createdAt: string;
  updatedAt: string;
}

interface InventorySummary {
  totalItems: number;
  lowStockItems: number;
  categories: string[];
}

interface PropertyOption {
  id: string;
  title: string;
}

interface Transaction {
  id: string;
  quantityChange: number;
  transactionType: string | null;
  notes: string | null;
  createdAt: string;
}

type ModalState =
  | { mode: "add" }
  | { mode: "edit"; item: InventoryItem }
  | { mode: "adjust"; item: InventoryItem }
  | { mode: "history"; item: InventoryItem }
  | null;

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [canManage, setCanManage] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [propertyFilter, setPropertyFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const [modal, setModal] = useState<ModalState>(null);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [itemsRes, summaryRes, propertiesRes] = await Promise.all([
        apiFetch("/api/inventory/items"),
        apiFetch("/api/inventory/summary"),
        apiFetch("/api/properties"),
      ]);

      setItems(itemsRes.data ?? []);
      setSummary(summaryRes.data ?? null);
      setProperties(
        (propertiesRes.data ?? []).map((p: { id: string; title: string }) => ({
          id: p.id,
          title: p.title,
        }))
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load inventory."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    async function loadRole() {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const response = await apiFetch("/api/organization/members");
        const self = (response.data ?? []).find(
          (member: { userId: string }) =>
            member.userId === session?.user?.id
        );

        setCanManage(
          self?.role === "owner" || self?.role === "company_admin"
        );
      } catch {
        setCanManage(false);
      }
    }

    loadRole();
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (propertyFilter && item.propertyId !== propertyFilter) return false;
      if (categoryFilter && item.category !== categoryFilter) return false;
      if (lowStockOnly && !item.isLowStock) return false;
      if (
        search &&
        !item.name.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [items, propertyFilter, categoryFilter, lowStockOnly, search]);

  async function handleDelete(item: InventoryItem) {
    const confirmed = window.confirm(
      `Delete "${item.name}"?\n\nThis will also delete its transaction history. This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setError("");

      await apiFetch(
        `/api/properties/${item.propertyId}/inventory/${item.id}`,
        { method: "DELETE" }
      );

      await loadAll();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete item."
      );
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 lg:p-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-4xl font-semibold text-slate-950">
            Inventory
          </h1>
          <p className="mt-2 text-lg text-slate-500">
            Track supplies and stock levels across your properties.
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => setModal({ mode: "add" })}
            className="rounded-xl bg-[#10172a] px-6 py-3 text-white hover:bg-[#18213a]"
          >
            + Add Item
          </button>
        )}
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Summary */}
      <div className="mt-8 grid gap-5 sm:grid-cols-3">
        <SummaryCard
          label="Total Items"
          value={summary?.totalItems ?? "—"}
        />
        <SummaryCard
          label="Low Stock Items"
          value={summary?.lowStockItems ?? "—"}
          tone={
            summary && summary.lowStockItems > 0 ? "warning" : "default"
          }
        />
        <SummaryCard
          label="Categories"
          value={summary?.categories.length ?? "—"}
        />
      </div>

      {/* Filters */}
      <div className="mt-8 flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <select
          value={propertyFilter}
          onChange={(event) => setPropertyFilter(event.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">All Properties</option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.title}
            </option>
          ))}
        </select>

        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">All Categories</option>
          {(summary?.categories ?? []).map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>

        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search items..."
          className="flex-1 min-w-[180px] rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />

        <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(event) => setLowStockOnly(event.target.checked)}
          />
          Low stock only
        </label>
      </div>

      {/* List */}
      {loading ? (
        <div className="mt-10 text-slate-500">Loading inventory...</div>
      ) : filteredItems.length === 0 ? (
        <div className="mt-10 rounded-2xl border bg-white p-10 text-center">
          <h2 className="text-2xl font-semibold text-slate-900">
            No inventory items found
          </h2>
          <p className="mt-2 text-slate-500">
            {items.length === 0
              ? "Add your first inventory item to start tracking stock."
              : "Try adjusting your filters."}
          </p>
        </div>
      ) : (
        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-5 py-3 font-medium text-slate-500">Item</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Property</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Category</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Quantity</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Minimum</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Status</th>
                  {canManage && (
                    <th className="px-5 py-3 font-medium text-slate-500">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-5 py-4 font-medium text-slate-900">{item.name}</td>
                    <td className="px-5 py-4 text-slate-600">{item.propertyTitle}</td>
                    <td className="px-5 py-4 text-slate-600">{item.category ?? "—"}</td>
                    <td className="px-5 py-4 text-slate-600">
                      {item.quantity}
                      {item.unit ? ` ${item.unit}` : ""}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {item.minimumQuantity}
                      {item.unit ? ` ${item.unit}` : ""}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${
                          item.isLowStock
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {item.isLowStock ? "Low Stock" : "OK"}
                      </span>
                    </td>
                    {canManage && (
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => setModal({ mode: "adjust", item })}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Adjust
                          </button>
                          <button
                            onClick={() => setModal({ mode: "history", item })}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            History
                          </button>
                          <button
                            onClick={() => setModal({ mode: "edit", item })}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(item)}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal?.mode === "add" && (
        <AddItemModal
          properties={properties}
          defaultPropertyId={propertyFilter}
          onClose={() => setModal(null)}
          onSaved={async () => {
            setModal(null);
            await loadAll();
          }}
        />
      )}

      {modal?.mode === "edit" && (
        <EditItemModal
          item={modal.item}
          onClose={() => setModal(null)}
          onSaved={async () => {
            setModal(null);
            await loadAll();
          }}
        />
      )}

      {modal?.mode === "adjust" && (
        <AdjustStockModal
          item={modal.item}
          onClose={() => setModal(null)}
          onSaved={async () => {
            setModal(null);
            await loadAll();
          }}
        />
      )}

      {modal?.mode === "history" && (
        <HistoryModal item={modal.item} onClose={() => setModal(null)} />
      )}
    </main>
  );
}

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "warning";
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p
        className={`mt-2 text-3xl font-semibold ${
          tone === "warning" && Number(value) > 0
            ? "text-red-600"
            : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
          >
            ×
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

function AddItemModal({
  properties,
  defaultPropertyId,
  onClose,
  onSaved,
}: {
  properties: PropertyOption[];
  defaultPropertyId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [propertyId, setPropertyId] = useState(defaultPropertyId);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("");
  const [minimumQuantity, setMinimumQuantity] = useState("0");
  const [initialQuantity, setInitialQuantity] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!propertyId) {
      setError("Please select a property.");
      return;
    }
    if (!name.trim()) {
      setError("Item name is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      await apiFetch(`/api/properties/${propertyId}/inventory`, {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          category: category.trim() || null,
          unit: unit.trim() || null,
          minimumQuantity: Number(minimumQuantity) || 0,
          initialQuantity: Number(initialQuantity) || 0,
        }),
      });

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add item.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Add Inventory Item" onClose={onClose}>
      <div className="space-y-3">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <select
          value={propertyId}
          onChange={(event) => setPropertyId(event.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">Select a property</option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.title}
            </option>
          ))}
        </select>

        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Item name (e.g. Towels)"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />

        <input
          type="text"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          placeholder="Category (optional)"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />

        <input
          type="text"
          value={unit}
          onChange={(event) => setUnit(event.target.value)}
          placeholder="Unit (e.g. pcs, bottles)"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="add-initial-quantity" className="text-xs text-slate-500">Starting Quantity</label>
            <input
              id="add-initial-quantity"
              type="number"
              min={0}
              value={initialQuantity}
              onChange={(event) => setInitialQuantity(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="add-minimum-quantity" className="text-xs text-slate-500">Minimum Threshold</label>
            <input
              id="add-minimum-quantity"
              type="number"
              min={0}
              value={minimumQuantity}
              onChange={(event) => setMinimumQuantity(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full rounded-xl bg-[#10172a] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#18213a] disabled:opacity-50"
        >
          {saving ? "Adding..." : "Add Item"}
        </button>
      </div>
    </ModalShell>
  );
}

function EditItemModal({
  item,
  onClose,
  onSaved,
}: {
  item: InventoryItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category ?? "");
  const [unit, setUnit] = useState(item.unit ?? "");
  const [minimumQuantity, setMinimumQuantity] = useState(
    String(item.minimumQuantity)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!name.trim()) {
      setError("Item name is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      await apiFetch(
        `/api/properties/${item.propertyId}/inventory/${item.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name: name.trim(),
            category: category.trim() || null,
            unit: unit.trim() || null,
            minimumQuantity: Number(minimumQuantity) || 0,
          }),
        }
      );

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update item.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Edit Inventory Item" onClose={onClose}>
      <div className="space-y-3">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />

        <input
          type="text"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          placeholder="Category"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />

        <input
          type="text"
          value={unit}
          onChange={(event) => setUnit(event.target.value)}
          placeholder="Unit"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />

        <div>
          <label htmlFor="edit-minimum-quantity" className="text-xs text-slate-500">Minimum Threshold</label>
          <input
            id="edit-minimum-quantity"
            type="number"
            min={0}
            value={minimumQuantity}
            onChange={(event) => setMinimumQuantity(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full rounded-xl bg-[#10172a] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#18213a] disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </ModalShell>
  );
}

function AdjustStockModal({
  item,
  onClose,
  onSaved,
}: {
  item: InventoryItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [direction, setDirection] = useState<"add" | "remove">("add");
  const [amount, setAmount] = useState("1");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    const parsed = Number(amount);

    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
      setError("Enter a positive whole number.");
      return;
    }

    const quantityChange = direction === "add" ? parsed : -parsed;

    try {
      setSaving(true);
      setError("");

      await apiFetch(
        `/api/properties/${item.propertyId}/inventory/${item.id}/adjust`,
        {
          method: "POST",
          body: JSON.stringify({
            quantityChange,
            reason: reason.trim() || null,
            notes: notes.trim() || null,
          }),
        }
      );

      onSaved();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to adjust stock."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title={`Adjust Stock — ${item.name}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-slate-500">
          Current: {item.quantity}
          {item.unit ? ` ${item.unit}` : ""} (minimum {item.minimumQuantity}
          {item.unit ? ` ${item.unit}` : ""})
        </p>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => setDirection("add")}
            className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium ${
              direction === "add"
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-slate-200 text-slate-600"
            }`}
          >
            + Add Stock
          </button>
          <button
            onClick={() => setDirection("remove")}
            className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium ${
              direction === "remove"
                ? "border-red-300 bg-red-50 text-red-700"
                : "border-slate-200 text-slate-600"
            }`}
          >
            − Remove Stock
          </button>
        </div>

        <input
          type="number"
          min={1}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />

        <input
          type="text"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason (e.g. restock, usage)"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />

        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Notes (optional)"
          rows={2}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full rounded-xl bg-[#10172a] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#18213a] disabled:opacity-50"
        >
          {saving ? "Saving..." : "Confirm Adjustment"}
        </button>
      </div>
    </ModalShell>
  );
}

function HistoryModal({
  item,
  onClose,
}: {
  item: InventoryItem;
  onClose: () => void;
}) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const response = await apiFetch(
          `/api/properties/${item.propertyId}/inventory/${item.id}/history`
        );

        setTransactions(response.data ?? []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load history."
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [item.propertyId, item.id]);

  return (
    <ModalShell title={`History — ${item.name}`} onClose={onClose}>
      {loading ? (
        <p className="text-sm text-slate-500">Loading history...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : transactions.length === 0 ? (
        <p className="text-sm text-slate-400">No transactions yet.</p>
      ) : (
        <ul className="max-h-80 space-y-2 overflow-y-auto">
          {transactions.map((tx) => (
            <li
              key={tx.id}
              className="rounded-xl bg-slate-50 p-3 text-sm"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`font-medium ${
                    tx.quantityChange >= 0 ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {tx.quantityChange >= 0 ? "+" : ""}
                  {tx.quantityChange}
                </span>
                <span className="text-xs text-slate-400">
                  {formatDate(tx.createdAt)}
                </span>
              </div>
              {tx.transactionType && (
                <p className="mt-1 text-xs text-slate-500 capitalize">
                  {tx.transactionType.replace(/_/g, " ")}
                </p>
              )}
              {tx.notes && (
                <p className="mt-1 text-xs text-slate-500">{tx.notes}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </ModalShell>
  );
}
