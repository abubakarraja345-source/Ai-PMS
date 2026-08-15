import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { supabase } from "../../config/supabase";
import { resolveEmail } from "../organization/service";
import { PlatformAdminSessionPayload } from "../../middleware/organization.middleware";
import {
  getBucketGranularity,
  bucketCounts,
  revenueTrend,
  revenueByCurrency,
} from "../reports/calculations";

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
  findAllPropertyOrganizationIds,
  findAllReservationsCreatedSince,
  findAllReservationsInRange,
  findIntegrationsForOrganization,
  findLastActivityAt,
  findMembersForOrganization,
  findOrganizationByIdForAdmin,
  findPlatformAdminAuditLog,
  findRecentAuditLogForOrganization,
  insertPlatformAdminAuditLog,
  updateOrganizationSubscriptionStatus,
} from "./repository";

import {
  OrganizationDetail,
  OrganizationHealthRow,
  PlatformCalendarEvent,
  PlatformInsight,
  PlatformLeaderboardEntry,
  PlatformReports,
  PlatformStats,
} from "./types";

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

/**
 * Cross-org calendar — every organization's reservations in one
 * range, labeled with which org and property each belongs to. No
 * guest data is included (see repository.ts's own comment on why
 * this is a separate query from the org-scoped one).
 */
export async function getPlatformCalendar(
  start: string,
  end: string
): Promise<PlatformCalendarEvent[]> {
  const rows = await findAllReservationsInRange(start, end);

  return rows.map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    organizationName: row.organization?.name ?? "Unknown organization",
    propertyTitle: row.property?.title ?? "Unknown property",
    bookingReference: row.booking_reference,
    status: row.status,
    checkIn: row.check_in,
    checkOut: row.check_out,
  }));
}

/** Every signed-up auth user's created_at — used only to bucket
 * signups over time for the growth chart, no other field is read.
 * Same "fetch all, aggregate in JS" tradeoff as resolveEmail/
 * listMembers elsewhere in this codebase, appropriate at this
 * product's scale. */
async function findAllUserCreatedTimestamps(): Promise<string[]> {
  const timestamps: string[] = [];
  const perPage = 1000;

  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    timestamps.push(...data.users.map((u) => u.created_at));

    if (data.users.length < perPage) break;
  }

  return timestamps;
}

/**
 * Platform-wide reports: revenue/booking trend (never blending
 * currencies — reuses reports/calculations.ts's revenueTrend, the
 * same approved rule the org-level Reports page already follows),
 * a per-organization leaderboard, and organization/user signup
 * growth over the trailing 90 days.
 */
export async function getPlatformReports(): Promise<PlatformReports> {
  const end = new Date();
  const start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const startDate = startIso.slice(0, 10);
  const endDate = endIso.slice(0, 10);

  const granularity = getBucketGranularity(startDate, endDate);

  const [reservations, organizations, propertyOrgIds, userTimestamps] =
    await Promise.all([
      findAllReservationsCreatedSince(startIso),
      findAllOrganizations(),
      findAllPropertyOrganizationIds(),
      findAllUserCreatedTimestamps(),
    ]);

  const propertyCountByOrg = new Map<string, number>();
  for (const orgId of propertyOrgIds) {
    propertyCountByOrg.set(orgId, (propertyCountByOrg.get(orgId) ?? 0) + 1);
  }

  const reservationsByOrg = new Map<string, typeof reservations>();
  for (const r of reservations) {
    const list = reservationsByOrg.get(r.organization_id) ?? [];
    list.push(r);
    reservationsByOrg.set(r.organization_id, list);
  }

  const leaderboard: PlatformLeaderboardEntry[] = organizations
    .map((org) => {
      const orgReservations = reservationsByOrg.get(org.id) ?? [];

      return {
        organizationId: org.id,
        name: org.name,
        bookingCount: orgReservations.length,
        revenue: revenueByCurrency(orgReservations),
        propertyCount: propertyCountByOrg.get(org.id) ?? 0,
      };
    })
    .sort((a, b) => b.bookingCount - a.bookingCount);

  return {
    period: { start: startDate, end: endDate, granularity },
    revenueTrend: revenueTrend(reservations, granularity),
    bookingTrend: bucketCounts(reservations, (r) => r.created_at, granularity),
    leaderboard,
    growth: {
      organizations: bucketCounts(organizations, (o) => o.created_at, granularity),
      users: bucketCounts(
        userTimestamps.map((created_at) => ({ created_at })),
        (u) => u.created_at,
        granularity
      ),
    },
  };
}

/**
 * Deterministic, non-AI platform insights — same posture as
 * ai/service.ts's org-level getInsights (see that module's own
 * route comment: "deterministic, non-AI dashboard insights"). No LLM
 * call: cheap, fast, and exactly as trustworthy as the numbers it's
 * built from.
 */
export async function getPlatformInsights(): Promise<PlatformInsight[]> {
  const [stats, reports] = await Promise.all([
    getPlatformStats(),
    getPlatformReports(),
  ]);

  const insights: PlatformInsight[] = [];

  if (stats.failedIntegrations > 0) {
    const n = stats.failedIntegrations;
    insights.push({
      type: "integrations_failing",
      severity: "warning",
      message: `${n} integration${n === 1 ? "" : "s"} reporting sync errors across the platform.`,
    });
  }

  if (stats.suspendedOrganizations > 0) {
    const n = stats.suspendedOrganizations;
    insights.push({
      type: "organizations_suspended",
      severity: "info",
      message: `${n} organization${n === 1 ? "" : "s"} currently suspended.`,
    });
  }

  if (stats.reviewRequired > 0) {
    const n = stats.reviewRequired;
    insights.push({
      type: "review_required",
      severity: stats.reviewRequired > 10 ? "warning" : "info",
      message: `${n} reservation${n === 1 ? "" : "s"} flagged for review across the platform.`,
    });
  }

  const zeroPropertyOrgs = reports.leaderboard.filter((o) => o.propertyCount === 0).length;
  if (zeroPropertyOrgs > 0) {
    insights.push({
      type: "organizations_no_properties",
      severity: "info",
      message: `${zeroPropertyOrgs} organization${zeroPropertyOrgs === 1 ? "" : "s"} ${zeroPropertyOrgs === 1 ? "has" : "have"} signed up but added no properties yet.`,
    });
  }

  const topOrg = reports.leaderboard[0];
  if (topOrg && topOrg.bookingCount > 0) {
    insights.push({
      type: "top_organization",
      severity: "info",
      message: `${topOrg.name} leads the platform with ${topOrg.bookingCount} booking${topOrg.bookingCount === 1 ? "" : "s"} in the last 90 days.`,
    });
  }

  const orgGrowth = reports.growth.organizations;
  if (orgGrowth.length >= 2) {
    const latest = orgGrowth[orgGrowth.length - 1];
    const previous = orgGrowth[orgGrowth.length - 2];

    if (latest && previous && latest.count > previous.count && previous.count > 0) {
      insights.push({
        type: "organization_growth_up",
        severity: "info",
        message: `New organization signups are up this period (${latest.count} vs ${previous.count}).`,
      });
    }
  }

  if (stats.totalOrganizations === 0) {
    insights.push({
      type: "no_organizations",
      severity: "info",
      message: "No organizations have signed up yet.",
    });
  }

  return insights;
}
