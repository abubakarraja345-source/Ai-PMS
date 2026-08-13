export type ApprovalStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface ApprovalRequestRow {
  id: string;
  organization_id: string;
  resource_action: string;
  entity_type: string;
  entity_id: string;
  requested_by: string;
  requested_by_label: string | null;
  status: ApprovalStatus;
  payload: Record<string, unknown>;
  original_snapshot: Record<string, unknown> | null;
  reviewed_by: string | null;
  reviewed_by_label: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApprovalRequestSummary {
  id: string;
  resourceAction: string;
  entityType: string;
  entityId: string;
  requestedBy: string;
  requestedByLabel: string | null;
  status: ApprovalStatus;
  payload: Record<string, unknown>;
  reviewedBy: string | null;
  reviewedByLabel: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}
