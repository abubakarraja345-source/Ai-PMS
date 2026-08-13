import { supabase } from "../../config/supabase";
import { PlatformAdminRow } from "./types";

export async function findPlatformAdminByUserId(
  userId: string
): Promise<PlatformAdminRow | null> {
  const { data, error } = await supabase
    .from("platform_admins")
    .select("id, user_id, label, created_note, created_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export interface InsertPlatformAdminAuditLogInput {
  platformAdminId: string;
  actorUserId: string | null;
  actorLabel: string | null;
  action: string;
  organizationId: string | null;
  reason: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Fire-and-forget, same posture as the existing audit_log's
 * logAudit() — a logging failure must never block or roll back the
 * platform-admin action it's describing.
 */
export async function insertPlatformAdminAuditLog(
  input: InsertPlatformAdminAuditLogInput
): Promise<void> {
  try {
    const { error } = await supabase.from("platform_admin_audit_log").insert({
      platform_admin_id: input.platformAdminId,
      actor_user_id: input.actorUserId,
      actor_label: input.actorLabel,
      action: input.action,
      organization_id: input.organizationId,
      reason: input.reason,
      metadata: input.metadata ?? null,
    });

    if (error) throw error;
  } catch (error) {
    console.error("Platform admin audit log write failed (non-fatal):", error);
  }
}

export async function findPlatformAdminAuditLog(
  filters: { organizationId?: string; platformAdminId?: string },
  range: { from: number; to: number }
) {
  let query = supabase
    .from("platform_admin_audit_log")
    .select(
      "id, platform_admin_id, actor_user_id, actor_label, action, organization_id, reason, metadata, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(range.from, range.to);

  if (filters.organizationId) {
    query = query.eq("organization_id", filters.organizationId);
  }

  if (filters.platformAdminId) {
    query = query.eq("platform_admin_id", filters.platformAdminId);
  }

  const { data, error, count } = await query;

  if (error) throw error;

  return { data: data ?? [], total: count ?? 0 };
}

export interface OrganizationRow {
  id: string;
  name: string;
  email: string | null;
  country: string | null;
  timezone: string | null;
  currency: string;
  subscription_plan: string;
  subscription_status: string;
  created_at: string;
}

export async function findAllOrganizations(): Promise<OrganizationRow[]> {
  const { data, error } = await supabase
    .from("organizations")
    .select(
      "id, name, email, country, timezone, currency, subscription_plan, subscription_status, created_at"
    )
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

export async function findOrganizationByIdForAdmin(
  organizationId: string
): Promise<OrganizationRow | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select(
      "id, name, email, country, timezone, currency, subscription_plan, subscription_status, created_at"
    )
    .eq("id", organizationId)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function updateOrganizationSubscriptionStatus(
  organizationId: string,
  status: "active" | "suspended"
): Promise<OrganizationRow | null> {
  const { data, error } = await supabase
    .from("organizations")
    .update({ subscription_status: status, updated_at: new Date().toISOString() })
    .eq("id", organizationId)
    .select(
      "id, name, email, country, timezone, currency, subscription_plan, subscription_status, created_at"
    )
    .maybeSingle();

  if (error) throw error;

  return data;
}

/**
 * Platform-wide counts (no organization_id filter — every existing
 * per-module repository always scopes to one organization; these are
 * the only counting queries in the codebase deliberately spanning
 * all of them, which is exactly what a platform-level dashboard is
 * for). Run in parallel by the caller via Promise.all.
 */
export async function countAllOrganizationMembers(): Promise<number> {
  const { count, error } = await supabase
    .from("organization_members")
    .select("id", { count: "exact", head: true });

  if (error) throw error;
  return count ?? 0;
}

export async function countAllProperties(): Promise<number> {
  const { count, error } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true });

  if (error) throw error;
  return count ?? 0;
}

export async function countAllReservations(): Promise<number> {
  const { count, error } = await supabase
    .from("reservations")
    .select("id", { count: "exact", head: true });

  if (error) throw error;
  return count ?? 0;
}

export async function countAllReservationsNeedingReview(): Promise<number> {
  const { count, error } = await supabase
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("needs_review", true);

  if (error) throw error;
  return count ?? 0;
}

export async function countAllIntegrationsByStatus(
  status: string
): Promise<number> {
  const { count, error } = await supabase
    .from("integrations")
    .select("id", { count: "exact", head: true })
    .eq("status", status);

  if (error) throw error;
  return count ?? 0;
}

export async function countPropertiesForOrganization(
  organizationId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  if (error) throw error;
  return count ?? 0;
}

export async function countReservationsForOrganization(
  organizationId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  if (error) throw error;
  return count ?? 0;
}

export async function countIntegrationsForOrganization(
  organizationId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("integrations")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  if (error) throw error;
  return count ?? 0;
}

export async function findMembersForOrganization(
  organizationId: string
): Promise<{ user_id: string; role: string }[]> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("user_id, role")
    .eq("organization_id", organizationId);

  if (error) throw error;

  return data ?? [];
}

/**
 * Column allowlist is deliberate and exhaustive — access_token,
 * refresh_token, and api_key exist on this table (see
 * integrations/types.ts) and must NEVER be selected here. This is
 * the platform-admin drill-down; a credential leak here would be far
 * worse than in any org-scoped endpoint since it's cross-organization
 * by design.
 */
export async function findIntegrationsForOrganization(
  organizationId: string
): Promise<{ id: string; provider: string; status: string; account_name: string | null }[]> {
  const { data, error } = await supabase
    .from("integrations")
    .select("id, provider, status, account_name")
    .eq("organization_id", organizationId);

  if (error) throw error;

  return data ?? [];
}

export async function findRecentAuditLogForOrganization(
  organizationId: string,
  limit: number
): Promise<
  { id: string; action: string; actor_label: string | null; entity_type: string; created_at: string }[]
> {
  const { data, error } = await supabase
    .from("audit_log")
    .select("id, action, actor_label, entity_type, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return data ?? [];
}

export async function findLastActivityAt(organizationId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("audit_log")
    .select("created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data?.created_at ?? null;
}
