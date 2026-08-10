import { supabase } from "../../config/supabase";
import { OrganizationMemberRow } from "./types";

export async function findMembersByOrganization(
  organizationId: string
): Promise<OrganizationMemberRow[]> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("id, organization_id, user_id, role, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function findMemberById(
  organizationId: string,
  memberId: string
): Promise<OrganizationMemberRow | null> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("id, organization_id, user_id, role, created_at")
    .eq("id", memberId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateMemberRole(
  organizationId: string,
  memberId: string,
  role: string
): Promise<OrganizationMemberRow | null> {
  const { data, error } = await supabase
    .from("organization_members")
    .update({ role })
    .eq("id", memberId)
    .eq("organization_id", organizationId)
    .select("id, organization_id, user_id, role, created_at")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteMember(
  organizationId: string,
  memberId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("organization_members")
    .delete()
    .eq("id", memberId)
    .eq("organization_id", organizationId)
    .select("id");

  if (error) {
    throw error;
  }

  return !!data && data.length > 0;
}
