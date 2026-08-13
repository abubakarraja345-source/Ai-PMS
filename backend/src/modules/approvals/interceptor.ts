import { OrganizationRole } from "../permissions/roles";
import { ResourceAction } from "../permissions/resourceActions";
import { getEffect } from "../permissions/service";
import { insertApprovalRequest } from "./repository";
import { ApprovalRequestSummary } from "./types";
import { logAudit } from "../auditLog/service";
import { notifyApprovalRequested } from "../notifications/service";

export type FieldTriggerMap = Record<
  string,
  ResourceAction | ((newValue: unknown, oldValue: unknown) => ResourceAction | null)
>;

/** Thrown when a triggered field change resolves to 'deny' for the
 * caller's role — distinct from a generic validation Error so the
 * route can map it to 403 instead of 400. */
export class ApprovalDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApprovalDeniedError";
  }
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

export type InterceptResult =
  | { deferred: false }
  | { deferred: true; approvalRequest: ApprovalRequestSummary };

/**
 * The field-diff approval gate for generic "PATCH the whole record"
 * endpoints (today: only reservations) that cover many different
 * kinds of edits behind one route, where a single coarse
 * requirePermission(...) can't distinguish "changed special_requests"
 * from "changed check_in". Never reimplements the underlying
 * mutation's own validation — it only decides whether to defer the
 * exact request body into approval_requests.payload for later replay
 * (see registry.ts) or let the caller proceed to call the real
 * service function immediately.
 *
 * Only FIELDS THAT ACTUALLY CHANGED trigger anything — resubmitting a
 * value identical to the current one is never treated as a sensitive
 * edit, matching the spec's "do not require approval for trivial
 * actions."
 */
export async function interceptForApproval(params: {
  organizationId: string;
  role: OrganizationRole;
  requesterId: string;
  requesterLabel: string | null;
  entityType: string;
  entityId: string;
  existing: Record<string, unknown>;
  updates: Record<string, unknown>;
  fieldTriggers: FieldTriggerMap;
}): Promise<InterceptResult> {
  const triggeredActions: ResourceAction[] = [];

  for (const [field, trigger] of Object.entries(params.fieldTriggers)) {
    if (!(field in params.updates)) continue;

    const newValue = params.updates[field];
    const oldValue = params.existing[field];

    if (JSON.stringify(newValue) === JSON.stringify(oldValue)) continue;

    const action =
      typeof trigger === "function" ? trigger(newValue, oldValue) : trigger;

    if (action && !triggeredActions.includes(action)) {
      triggeredActions.push(action);
    }
  }

  if (triggeredActions.length === 0) {
    return { deferred: false };
  }

  const effects = await Promise.all(
    triggeredActions.map((action) =>
      getEffect(params.organizationId, params.role, action)
    )
  );

  if (effects.includes("deny")) {
    throw new ApprovalDeniedError(
      `You do not have permission to change: ${triggeredActions.join(", ")}`
    );
  }

  if (!effects.includes("approval")) {
    // Every triggered action resolves to "allow" for this role —
    // proceed immediately, no deferral.
    return { deferred: false };
  }

  const created = await insertApprovalRequest({
    organization_id: params.organizationId,
    resource_action: triggeredActions.join(","),
    entity_type: params.entityType,
    entity_id: params.entityId,
    requested_by: params.requesterId,
    requested_by_label: params.requesterLabel,
    payload: params.updates,
    original_snapshot: params.existing,
  });

  void logAudit({
    organizationId: params.organizationId,
    actorUserId: params.requesterId,
    actorLabel: params.requesterLabel ?? params.requesterId,
    action: "approval.requested",
    entityType: "approval_request",
    entityId: created.id,
    metadata: {
      resourceAction: created.resource_action,
      targetEntityType: params.entityType,
      targetEntityId: params.entityId,
    },
  });

  void notifyApprovalRequested(params.organizationId, {
    requesterLabel: params.requesterLabel ?? "A team member",
    entityType: params.entityType,
    resourceAction: created.resource_action,
  });

  return { deferred: true, approvalRequest: toSummary(created) };
}
