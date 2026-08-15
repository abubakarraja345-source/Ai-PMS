export interface PlatformAdminRow {
  id: string;
  user_id: string;
  label: string | null;
  created_note: string | null;
  created_at: string;
}

export interface PlatformStats {
  totalOrganizations: number;
  activeOrganizations: number;
  suspendedOrganizations: number;
  /** Every user who belongs to an organization (organization_members
   * has one row per user, enforced by a UNIQUE constraint on
   * user_id — see organization_members_user_id_unique migration) —
   * not every auth.users row, which could include signups who never
   * finished onboarding into an organization at all. */
  totalUsers: number;
  totalProperties: number;
  totalReservations: number;
  activeIntegrations: number;
  failedIntegrations: number;
  reviewRequired: number;
}

export interface OrganizationHealthRow {
  id: string;
  name: string;
  ownerEmail: string | null;
  memberCount: number;
  propertyCount: number;
  reservationCount: number;
  integrationCount: number;
  subscriptionStatus: string;
  subscriptionPlan: string;
  lastActivityAt: string | null;
  createdAt: string;
}

export interface PlatformCalendarEvent {
  id: string;
  organizationId: string;
  organizationName: string;
  propertyTitle: string;
  bookingReference: string | null;
  status: string;
  checkIn: string;
  checkOut: string;
}

export interface PlatformLeaderboardEntry {
  organizationId: string;
  name: string;
  bookingCount: number;
  /** Never blended across currencies — same rule reports/calculations.ts
   * already enforces at the org level (see revenueByCurrency). */
  revenue: { currency: string; total: number; count: number }[];
  propertyCount: number;
}

export interface PlatformReports {
  period: { start: string; end: string; granularity: "day" | "week" | "month" };
  revenueTrend: { bucket: string; currency: string; total: number; count: number }[];
  bookingTrend: { bucket: string; count: number }[];
  leaderboard: PlatformLeaderboardEntry[];
  growth: {
    organizations: { bucket: string; count: number }[];
    users: { bucket: string; count: number }[];
  };
}

export type PlatformInsightSeverity = "info" | "warning" | "critical";

export interface PlatformInsight {
  type: string;
  severity: PlatformInsightSeverity;
  message: string;
}

export interface OrganizationDetail {
  id: string;
  name: string;
  email: string | null;
  country: string | null;
  timezone: string | null;
  currency: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  createdAt: string;
  owner: { userId: string; email: string | null } | null;
  members: { userId: string; email: string | null; role: string }[];
  propertyCount: number;
  reservationCount: number;
  integrations: {
    id: string;
    provider: string;
    status: string;
    /** Never access_token/refresh_token/api_key — see repository.ts's
     * explicit column allowlist. This module must never surface a
     * credential to any response, no matter how deep the drill-down. */
    accountName: string | null;
  }[];
  recentAuditEvents: {
    id: string;
    action: string;
    actorLabel: string | null;
    entityType: string;
    createdAt: string;
  }[];
}
