import { supabase } from "../../config/supabase";
import { OrganizationRow, SettingsRow } from "./types";

export async function findOrganizationById(
  organizationId: string
): Promise<OrganizationRow | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, updated_at")
    .eq("id", organizationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateOrganizationName(
  organizationId: string,
  name: string
): Promise<OrganizationRow | null> {
  const { data, error } = await supabase
    .from("organizations")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", organizationId)
    .select("id, name, updated_at")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function findSettingsByOrganization(
  organizationId: string
): Promise<SettingsRow | null> {
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * `settings` has no unique constraint on organization_id visible
 * via introspection, so uniqueness is enforced here: look up the
 * existing row first, then update or insert accordingly, rather
 * than relying on a database-level upsert.
 */
export async function upsertSettings(
  organizationId: string,
  fields: Record<string, unknown>
): Promise<SettingsRow> {
  const existing = await findSettingsByOrganization(organizationId);

  if (existing) {
    const { data, error } = await supabase
      .from("settings")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  const { data, error } = await supabase
    .from("settings")
    .insert({ organization_id: organizationId, ...fields })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}
