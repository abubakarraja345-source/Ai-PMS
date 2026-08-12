import { supabase } from "../../config/supabase";
import { AuditLogRow } from "./types";

export interface InsertAuditLogInput {
  organization_id: string;
  actor_user_id: string | null;
  actor_label: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
}

export async function insertAuditLog(
  input: InsertAuditLogInput
): Promise<void> {
  const { error } = await supabase.from("audit_log").insert(input);

  if (error) {
    throw error;
  }
}

export interface AuditLogFilters {
  actorUserId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  start?: string;
  end?: string;
}

export async function findAuditLog(
  organizationId: string,
  filters: AuditLogFilters,
  range: { from: number; to: number }
): Promise<{ data: AuditLogRow[]; total: number }> {
  let query = supabase
    .from("audit_log")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .range(range.from, range.to);

  if (filters.actorUserId) {
    query = query.eq("actor_user_id", filters.actorUserId);
  }

  if (filters.entityType) {
    query = query.eq("entity_type", filters.entityType);
  }

  if (filters.entityId) {
    query = query.eq("entity_id", filters.entityId);
  }

  if (filters.action) {
    query = query.eq("action", filters.action);
  }

  if (filters.start) {
    query = query.gte("created_at", filters.start);
  }

  if (filters.end) {
    query = query.lte("created_at", filters.end);
  }

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  return { data: data ?? [], total: count ?? 0 };
}
