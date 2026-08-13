import {
  findApprovalRequestById,
  findApprovalRequestsByOrganization,
  updateApprovalRequestStatus,
} from "./repository";
import { ApprovalRequestSummary } from "./types";
import { getApplyFn } from "./registry";
import { logAudit } from "../auditLog/service";
import {
  notifyApprovalApproved,
  notifyApprovalRejected,
} from "../notifications/service";

export interface ApprovalActor {
  id: string;
  email?: string;
}

function toSummary(row: {
  id: string;
  resource_action: string;
  entity_type: string;
  entity_id: string;
  requested_by: string;
  requested_by_label: string | null;
  status: string;
  payload: Record<string, unknown>;
  reviewed_by: string | null;
  reviewed_by_label: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}): ApprovalRequestSummary {
  return {
    id: row.id,
    resourceAction: row.resource_action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    requestedBy: row.requested_by,
    requestedByLabel: row.requested_by_label,
    status: row.status as ApprovalRequestSummary["status"],
    payload: row.payload,
    reviewedBy: row.reviewed_by,
    reviewedByLabel: row.reviewed_by_label,
    reviewNote: row.review_note,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

/**
 * A caller with approvals.review permission sees every request in the
 * organization (that's the point of the role); anyone else only ever
 * sees their own — "did my change get approved yet" is legitimate
 * self-service visibility, seeing a coworker's pending request is not.
 */
export async function listApprovals(
  organizationId: string,
  callerCanReview: boolean,
  callerId: string,
  filters: { status?: "pending" | "approved" | "rejected" | "cancelled" },
  page: number
) {
  const PAGE_SIZE = 25;
  const safePage = Math.max(page, 1);
  const from = (safePage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, total } = await findApprovalRequestsByOrganization(
    organizationId,
    {
      ...filters,
      ...(callerCanReview ? {} : { requestedBy: callerId }),
    },
    { from, to }
  );

  return {
    data: data.map(toSummary),
    total,
    page: safePage,
    totalPages: Math.max(Math.ceil(total / PAGE_SIZE), 1),
  };
}

export async function approveRequest(
  organizationId: string,
  requestId: string,
  reviewer: ApprovalActor,
  reviewNote: string | null
): Promise<ApprovalRequestSummary> {
  const request = await findApprovalRequestById(organizationId, requestId);

  if (!request) {
    throw new Error("Approval request not found");
  }

  if (request.status !== "pending") {
    throw new Error("Only pending requests can be approved");
  }

  if (request.requested_by === reviewer.id) {
    throw new Error("You cannot approve your own request");
  }

  const applyFn = getApplyFn(request.entity_type);

  if (!applyFn) {
    throw new Error(`No handler registered for entity type "${request.entity_type}"`);
  }

  // Claim the request FIRST — same atomic-conditional-update pattern
  // as invitations' markInvitationAccepted, so two reviewers racing to
  // approve the same request can't both succeed.
  const claimed = await updateApprovalRequestStatus(
    requestId,
    "approved",
    reviewer.id,
    reviewer.email ?? reviewer.id,
    reviewNote
  );

  if (!claimed) {
    throw new Error("This request has already been reviewed");
  }

  // Apply the actual mutation AFTER claiming, using the reviewer as
  // actor (they're the one causing the write to happen now) — the
  // approval_requests row itself is the durable record of who
  // originally asked for it.
  await applyFn(organizationId, request.entity_id, request.payload, reviewer);

  void logAudit({
    organizationId,
    actorUserId: reviewer.id,
    actorLabel: reviewer.email ?? reviewer.id,
    action: "approval.approved",
    entityType: "approval_request",
    entityId: request.id,
    metadata: {
      resourceAction: request.resource_action,
      targetEntityType: request.entity_type,
      targetEntityId: request.entity_id,
    },
  });

  void notifyApprovalApproved(organizationId, {
    requestedBy: request.requested_by,
    entityType: request.entity_type,
    resourceAction: request.resource_action,
  });

  return toSummary(claimed);
}

export async function rejectRequest(
  organizationId: string,
  requestId: string,
  reviewer: ApprovalActor,
  reviewNote: string | null
): Promise<ApprovalRequestSummary> {
  const request = await findApprovalRequestById(organizationId, requestId);

  if (!request) {
    throw new Error("Approval request not found");
  }

  if (request.status !== "pending") {
    throw new Error("Only pending requests can be rejected");
  }

  if (request.requested_by === reviewer.id) {
    throw new Error("You cannot reject your own request");
  }

  const claimed = await updateApprovalRequestStatus(
    requestId,
    "rejected",
    reviewer.id,
    reviewer.email ?? reviewer.id,
    reviewNote
  );

  if (!claimed) {
    throw new Error("This request has already been reviewed");
  }

  void logAudit({
    organizationId,
    actorUserId: reviewer.id,
    actorLabel: reviewer.email ?? reviewer.id,
    action: "approval.rejected",
    entityType: "approval_request",
    entityId: request.id,
    metadata: {
      resourceAction: request.resource_action,
      targetEntityType: request.entity_type,
      targetEntityId: request.entity_id,
      reviewNote,
    },
  });

  void notifyApprovalRejected(organizationId, {
    requestedBy: request.requested_by,
    entityType: request.entity_type,
    resourceAction: request.resource_action,
  });

  return toSummary(claimed);
}
