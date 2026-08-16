"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface Rule {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
}

export default function PropertyRulesSection({
  propertyId,
  canManage,
}: {
  propertyId: string;
  canManage: boolean;
}) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadRules = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await apiFetch(
        `/api/properties/${propertyId}/rules`
      );

      setRules(response.data ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load house rules."
      );
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  async function handleAdd() {
    if (!title.trim()) return;

    try {
      setSaving(true);
      setError("");

      await apiFetch(`/api/properties/${propertyId}/rules`, {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
        }),
      });

      setTitle("");
      setDescription("");
      await loadRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add rule.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(ruleId: string) {
    try {
      setDeletingId(ruleId);
      setError("");

      await apiFetch(`/api/properties/${propertyId}/rules/${ruleId}`, {
        method: "DELETE",
      });

      setRules((current) => current.filter((rule) => rule.id !== ruleId));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete rule."
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-foreground">House Rules</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Guidelines guests should follow during their stay.
      </p>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-5 text-sm text-muted-foreground">
          Loading house rules...
        </div>
      ) : rules.length === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground/80">
          No house rules added yet.
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className="flex items-start justify-between gap-3 rounded-xl bg-muted p-4"
            >
              <div>
                <p className="text-sm font-medium text-foreground">
                  {rule.title}
                </p>

                {rule.description && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {rule.description}
                  </p>
                )}
              </div>

              {canManage && (
                <button
                  onClick={() => handleDelete(rule.id)}
                  disabled={deletingId === rule.id}
                  className="flex-shrink-0 text-xs text-muted-foreground/80 hover:text-red-600 disabled:opacity-50"
                >
                  {deletingId === rule.id ? "..." : "Delete"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <div className="mt-5 space-y-3">
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Rule title (e.g. No smoking)"
            className="w-full rounded-xl border border-border px-4 py-2.5 text-sm"
          />

          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="w-full rounded-xl border border-border px-4 py-2.5 text-sm"
          />

          <button
            onClick={handleAdd}
            disabled={saving || !title.trim()}
            className="rounded-xl bg-gradient-to-r from-primary to-accent px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Adding..." : "Add Rule"}
          </button>
        </div>
      )}
    </section>
  );
}
