import { supabase } from "../../config/supabase";
import { OrganizationRole } from "./roles";
import { ResourceAction } from "./resourceActions";
import { PermissionEffect } from "./matrix";

export interface RolePermissionOverrideRow {
  id: string;
  organization_id: string;
  role: string;
  resource_action: string;
  effect: PermissionEffect;
  created_at: string;
  updated_at: string;
}

/**
 * Deliberately tolerant of the table not existing yet: migrations in
 * this project are handed to the user as .sql files they run manually
 * in the Supabase Dashboard SQL Editor (this backend cannot execute
 * DDL directly), so there is necessarily a window between this code
 * shipping and the 20260817040000_role_permission_overrides.sql
 * migration actually being applied. Treating "table doesn't exist
 * yet" the same as "no overrides exist" (rather than throwing and
 * 500ing every single permission check across the whole app) means
 * the permission engine degrades to the hardcoded PERMISSION_MATRIX
 * defaults during that window instead of taking the app down. Once
 * the migration runs, this starts returning real rows immediately —
 * no restart required.
 */
export async function findOverridesByOrganization(
  organizationId: string
): Promise<RolePermissionOverrideRow[]> {
  const { data, error } = await supabase
    .from("role_permission_overrides")
    .select("id, organization_id, role, resource_action, effect, created_at, updated_at")
    .eq("organization_id", organizationId);

  if (error) {
    // "relation does not exist" — the migration hasn't been run yet.
    // Queries go through Supabase's PostgREST layer (not a raw SQL
    // connection), which surfaces this as its own error code
    // (PGRST205, "table not found in schema cache") rather than
    // Postgres's native 42P01 — checking both since which one shows
    // up isn't obvious without hitting it live (confirmed PGRST205 is
    // what this project's Supabase client actually returns).
    if (error.code === "42P01" || error.code === "PGRST205") {
      return [];
    }

    throw error;
  }

  return data ?? [];
}

export async function upsertOverride(
  organizationId: string,
  role: OrganizationRole,
  resourceAction: ResourceAction,
  effect: PermissionEffect
): Promise<RolePermissionOverrideRow> {
  const { data, error } = await supabase
    .from("role_permission_overrides")
    .upsert(
      {
        organization_id: organizationId,
        role,
        resource_action: resourceAction,
        effect,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,role,resource_action" }
    )
    .select("id, organization_id, role, resource_action, effect, created_at, updated_at")
    .single();

  if (error) throw error;

  return data;
}

export async function deleteOverride(
  organizationId: string,
  role: OrganizationRole,
  resourceAction: ResourceAction
): Promise<boolean> {
  const { data, error } = await supabase
    .from("role_permission_overrides")
    .delete()
    .eq("organization_id", organizationId)
    .eq("role", role)
    .eq("resource_action", resourceAction)
    .select("id");

  if (error) throw error;

  return !!data && data.length > 0;
}
