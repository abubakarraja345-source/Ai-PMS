import { supabase } from "../../config/supabase";
import { ApprovalRequestRow, ApprovalStatus } from "./types";

const SELECT =
  "id, organization_id, resource_action, entity_type, entity_id, requested_by, requested_by_label, status, payload, original_snapshot, reviewed_by, reviewed_by_label, review_note, reviewed_at, created_at, updated_at";

export async function insertApprovalRequest(input: {
  organization_id: string;
  resource_action: string;
  entity_type: string;
  entity_id: string;
  requested_by: string;
  requested_by_label: string | null;
  payload: Record<string, unknown>;
  original_snapshot: Record<string, unknown> | null;
}): Promise<ApprovalRequestRow> {
  const { data, error } = await supabase
    .from("approval_requests")
    .insert(input)
    .select(SELECT)
    .single();

  if (error) throw error;
  return data;
}

export async function findApprovalRequestById(
  organizationId: string,
  id: string
): Promise<ApprovalRequestRow | null> {
  const { data, error } = await supabase
    .from("approval_requests")
    .select(SELECT)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export interface ApprovalListFilters {
  status?: ApprovalStatus;
  requestedBy?: string;
}

export async function findApprovalRequestsByOrganization(
  organizationId: string,
  filters: ApprovalListFilters,
  range: { from: number; to: number }
): Promise<{ data: ApprovalRequestRow[]; total: number }> {
  let query = supabase
    .from("approval_requests")
    .select(SELECT, { count: "exact" })
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .range(range.from, range.to);

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.requestedBy) {
    query = query.eq("requested_by", filters.requestedBy);
  }

  const { data, error, count } = await query;

  if (error) throw error;

  return { data: data ?? [], total: count ?? 0 };
}

/**
 * Atomically claims a pending request for review — the WHERE
 * status='pending' guard closes a race (two reviewers approving/
 * rejecting the same request at once can't both succeed; the loser's
 * UPDATE matches zero rows and this returns null).
 */
export async function updateApprovalRequestStatus(
  id: string,
  status: "approved" | "rejected",
  reviewedBy: string,
  reviewedByLabel: string | null,
  reviewNote: string | null
): Promise<ApprovalRequestRow | null> {
  const { data, error } = await supabase
    .from("approval_requests")
    .update({
      status,
      reviewed_by: reviewedBy,
      reviewed_by_label: reviewedByLabel,
      review_note: reviewNote,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending")
    .select(SELECT)
    .maybeSingle();

  if (error) throw error;
  return data;
}
