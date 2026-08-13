import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { resolveEmail } from "../organization/service";
import { PlatformAdminSessionPayload } from "../../middleware/organization.middleware";

import {
  countAllIntegrationsByStatus,
  countAllOrganizationMembers,
  countAllProperties,
  countAllReservations,
  countAllReservationsNeedingReview,
  countIntegrationsForOrganization,
  countPropertiesForOrganization,
  countReservationsForOrganization,
  findAllOrganizations,
  findIntegrationsForOrganization,
  findLastActivityAt,
  findMembersForOrganization,
  findOrganizationByIdForAdmin,
  findPlatformAdminAuditLog,
  findRecentAuditLogForOrganization,
  insertPlatformAdminAuditLog,
  updateOrganizationSubscriptionStatus,
} from "./repository";

import { OrganizationDetail, OrganizationHealthRow, PlatformStats } from "./types";

export interface PlatformAdminActor {
  platformAdminId: string;
  userId: string;
  email?: string | null;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const organizations = await findAllOrganizations();

  const [
    totalUsers,
    totalProperties,
    totalReservations,
    activeIntegrations,
    failedIntegrations,
    reviewRequired,
  ] = await Promise.all([
    countAllOrganizationMembers(),
    countAllProperties(),
    countAllReservations(),
    countAllIntegrationsByStatus("active"),
    countAllIntegrationsByStatus("error"),
    countAllReservationsNeedingReview(),
  ]);

  return {
    totalOrganizations: organizations.length,
    activeOrganizations: organizations.filter(
      (o) => o.subscription_status === "active"
    ).length,
    suspendedOrganizations: organizations.filter(
      (o) => o.subscription_status === "suspended"
    ).length,
    totalUsers,
    totalProperties,
    totalReservations,
    activeIntegrations,
    failedIntegrations,
    reviewRequired,
  };
}

export async function listOrganizationHealth(): Promise<OrganizationHealthRow[]> {
  const organizations = await findAllOrganizations();

  return Promise.all(
    organizations.map(async (org) => {
      const [members, propertyCount, reservationCount, integrationCount, lastActivityAt] =
        await Promise.all([
          findMembersForOrganization(org.id),
          countPropertiesForOrganization(org.id),
          countReservationsForOrganization(org.id),
          countIntegrationsForOrganization(org.id),
          findLastActivityAt(org.id),
        ]);

      const owner = members.find((m) => m.role === "owner");
      const ownerEmail = owner ? await resolveEmail(owner.user_id) : null;

      return {
        id: org.id,
        name: org.name,
        ownerEmail,
        memberCount: members.length,
        propertyCount,
        reservationCount,
        integrationCount,
        subscriptionStatus: org.subscription_status,
        subscriptionPlan: org.subscription_plan,
        lastActivityAt,
        createdAt: org.created_at,
      };
    })
  );
}

export async function getOrganizationDetail(
  organizationId: string
): Promise<OrganizationDetail | null> {
  const org = await findOrganizationByIdForAdmin(organizationId);

  if (!org) {
    return null;
  }

  const [members, propertyCount, reservationCount, integrations, recentAudit] =
    await Promise.all([
      findMembersForOrganization(organizationId),
      countPropertiesForOrganization(organizationId),
      countReservationsForOrganization(organizationId),
      findIntegrationsForOrganization(organizationId),
      findRecentAuditLogForOrganization(organizationId, 20),
    ]);

  const membersWithEmail = await Promise.all(
    members.map(async (m) => ({
      userId: m.user_id,
      role: m.role,
      email: await resolveEmail(m.user_id),
    }))
  );

  const ownerRow = membersWithEmail.find((m) => m.role === "owner") ?? null;

  return {
    id: org.id,
    name: org.name,
    email: org.email,
    country: org.country,
    timezone: org.timezone,
    currency: org.currency,
    subscriptionPlan: org.subscription_plan,
    subscriptionStatus: org.subscription_status,
    createdAt: org.created_at,
    owner: ownerRow ? { userId: ownerRow.userId, email: ownerRow.email } : null,
    members: membersWithEmail,
    propertyCount,
    reservationCount,
    integrations: integrations.map((i) => ({
      id: i.id,
      provider: i.provider,
      status: i.status,
      accountName: i.account_name,
    })),
    recentAuditEvents: recentAudit.map((a) => ({
      id: a.id,
      action: a.action,
      actorLabel: a.actor_label,
      entityType: a.entity_type,
      createdAt: a.created_at,
    })),
  };
}

export async function setOrganizationSuspension(
  organizationId: string,
  suspended: boolean,
  actor: PlatformAdminActor
) {
  const updated = await updateOrganizationSubscriptionStatus(
    organizationId,
    suspended ? "suspended" : "active"
  );

  if (!updated) {
    return null;
  }

  void insertPlatformAdminAuditLog({
    platformAdminId: actor.platformAdminId,
    actorUserId: actor.userId,
    actorLabel: actor.email ?? actor.userId,
    action: suspended ? "organization.suspended" : "organization.reactivated",
    organizationId,
    reason: null,
  });

  return updated;
}

const SESSION_TTL_SECONDS = 15 * 60;

export class PlatformAdminSessionSigningNotConfiguredError extends Error {
  constructor() {
    super(
      "Platform admin session signing is not configured — set JWT_SECRET in the backend environment."
    );
    this.name = "PlatformAdminSessionSigningNotConfiguredError";
  }
}

/**
 * "Entering" an organization — mints a short-lived, signed session
 * token scoping subsequent read-only requests to this organization
 * (see organization.middleware.ts's resolvePlatformAdminOverride,
 * which verifies this token and additionally pins it to the exact
 * authenticated caller it was minted for). Always audit-logged with
 * the caller-supplied reason before the token is returned — never
 * silent.
 */
export async function enterOrganization(
  organizationId: string,
  reason: string,
  actor: PlatformAdminActor
): Promise<{ impersonationToken: string; organization: { id: string; name: string } }> {
  if (!env.jwtSecret) {
    throw new PlatformAdminSessionSigningNotConfiguredError();
  }

  const org = await findOrganizationByIdForAdmin(organizationId);

  if (!org) {
    throw new Error("Organization not found");
  }

  const payload: PlatformAdminSessionPayload = {
    platformAdminId: actor.platformAdminId,
    platformAdminUserId: actor.userId,
    organizationId: org.id,
    organizationName: org.name,
    reason,
  };

  const impersonationToken = jwt.sign(payload, env.jwtSecret, {
    expiresIn: SESSION_TTL_SECONDS,
  });

  void insertPlatformAdminAuditLog({
    platformAdminId: actor.platformAdminId,
    actorUserId: actor.userId,
    actorLabel: actor.email ?? actor.userId,
    action: "organization.entered",
    organizationId: org.id,
    reason,
  });

  return {
    impersonationToken,
    organization: { id: org.id, name: org.name },
  };
}

export async function exitOrganization(
  organizationId: string,
  actor: PlatformAdminActor
): Promise<void> {
  void insertPlatformAdminAuditLog({
    platformAdminId: actor.platformAdminId,
    actorUserId: actor.userId,
    actorLabel: actor.email ?? actor.userId,
    action: "organization.exited",
    organizationId,
    reason: null,
  });
}

export async function listPlatformAdminAuditLog(
  filters: { organizationId?: string },
  page: number
) {
  const PAGE_SIZE = 25;
  const safePage = Math.max(page, 1);
  const from = (safePage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, total } = await findPlatformAdminAuditLog(filters, { from, to });

  return {
    data,
    total,
    page: safePage,
    totalPages: Math.max(Math.ceil(total / PAGE_SIZE), 1),
  };
}
