import { insertAuditLog, findAuditLog, AuditLogFilters } from "./repository";
import { AuditAction, AuditEntityType, AuditLogRow } from "./types";

export interface LogAuditInput {
  organizationId: string;
  actorUserId: string | null;
  actorLabel: string | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Fire-and-forget: records an audit entry, but never throws and never
 * blocks the caller's real action. A logging failure (e.g. the
 * migration hasn't been applied yet, or a transient DB hiccup) must
 * never roll back or delay the reservation/invitation/etc. it's
 * describing — it's a side-effect record, not part of the operation's
 * own correctness. Callers call this without awaiting.
 */
export async function logAudit(input: LogAuditInput): Promise<void> {
  try {
    await insertAuditLog({
      organization_id: input.organizationId,
      actor_user_id: input.actorUserId,
      actor_label: input.actorLabel,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      metadata: input.metadata ?? null,
    });
  } catch (error) {
    console.error("Audit log write failed (non-fatal):", error);
  }
}

export interface AuditLogListResult {
  data: AuditLogRow[];
  total: number;
  page: number;
  totalPages: number;
}

const PAGE_SIZE = 25;

export async function listAuditLog(
  organizationId: string,
  filters: AuditLogFilters,
  page: number
): Promise<AuditLogListResult> {
  const safePage = Math.max(page, 1);
  const from = (safePage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, total } = await findAuditLog(organizationId, filters, {
    from,
    to,
  });

  return {
    data,
    total,
    page: safePage,
    totalPages: Math.max(Math.ceil(total / PAGE_SIZE), 1),
  };
}
