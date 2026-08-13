import { editReservation } from "../reservations/service";

export interface ApprovalActor {
  id: string;
  email?: string;
}

type ApplyFn = (
  organizationId: string,
  entityId: string,
  payload: Record<string, unknown>,
  actor: ApprovalActor
) => Promise<unknown>;

/**
 * entity_type -> the exact same service-layer function the immediate
 * (non-deferred) path would have called, so approving a request
 * replays it through identical validation/conflict-detection logic —
 * never a second, parallel implementation of "how to apply a
 * reservation edit." Only "reservation" exists today since the
 * interceptor is only wired into the reservations PATCH endpoint;
 * extending approvals to another entity type later means adding one
 * line here, not a new engine.
 */
const REGISTRY: Record<string, ApplyFn> = {
  reservation: (organizationId, entityId, payload, actor) =>
    editReservation(organizationId, entityId, payload, actor),
};

export function getApplyFn(entityType: string): ApplyFn | null {
  return REGISTRY[entityType] ?? null;
}
