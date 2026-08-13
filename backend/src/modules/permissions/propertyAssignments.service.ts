import {
  findAssignmentsForProperty,
  insertPropertyAssignment,
  deletePropertyAssignment,
} from "./propertyAssignments.repository";
import { findMembersByOrganization } from "../organization/repository";
import { resolveEmail } from "../organization/service";
import { logAudit } from "../auditLog/service";

export interface AssignmentActor {
  id: string;
  email?: string;
}

export interface PropertyAssignmentSummary {
  userId: string;
  email: string | null;
  role: string;
}

export async function listPropertyAssignments(
  organizationId: string,
  propertyId: string
): Promise<PropertyAssignmentSummary[]> {
  const [assignments, members] = await Promise.all([
    findAssignmentsForProperty(organizationId, propertyId),
    findMembersByOrganization(organizationId),
  ]);

  const memberByUserId = new Map(members.map((m) => [m.user_id, m.role]));

  return Promise.all(
    assignments.map(async (a) => ({
      userId: a.user_id,
      email: await resolveEmail(a.user_id),
      role: memberByUserId.get(a.user_id) ?? "unknown",
    }))
  );
}

export async function assignPropertyToUser(
  organizationId: string,
  propertyId: string,
  targetUserId: string,
  actor: AssignmentActor
): Promise<void> {
  const members = await findMembersByOrganization(organizationId);

  if (!members.some((m) => m.user_id === targetUserId)) {
    throw new Error("User is not a member of your organization");
  }

  await insertPropertyAssignment(organizationId, propertyId, targetUserId, actor.id);

  void logAudit({
    organizationId,
    actorUserId: actor.id,
    actorLabel: actor.email ?? actor.id,
    action: "property.assignment_added",
    entityType: "property",
    entityId: propertyId,
    metadata: { assignedUserId: targetUserId },
  });
}

export async function unassignPropertyFromUser(
  organizationId: string,
  propertyId: string,
  targetUserId: string,
  actor: AssignmentActor
): Promise<boolean> {
  const removed = await deletePropertyAssignment(organizationId, propertyId, targetUserId);

  if (removed) {
    void logAudit({
      organizationId,
      actorUserId: actor.id,
      actorLabel: actor.email ?? actor.id,
      action: "property.assignment_removed",
      entityType: "property",
      entityId: propertyId,
      metadata: { unassignedUserId: targetUserId },
    });
  }

  return removed;
}
