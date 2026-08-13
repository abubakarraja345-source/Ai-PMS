import { supabase } from "../../config/supabase";

export interface PropertyAssignmentRow {
  id: string;
  organization_id: string;
  property_id: string;
  user_id: string;
  assigned_by: string | null;
  created_at: string;
}

/** Just the property_ids a given user is assigned to, org-scoped —
 * the one query resolvePropertyScope actually needs. */
export async function findAssignedPropertyIds(
  organizationId: string,
  userId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from("property_assignments")
    .select("property_id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId);

  if (error) throw error;

  return (data ?? []).map((r) => r.property_id);
}

export async function findAssignmentsForProperty(
  organizationId: string,
  propertyId: string
): Promise<PropertyAssignmentRow[]> {
  const { data, error } = await supabase
    .from("property_assignments")
    .select("id, organization_id, property_id, user_id, assigned_by, created_at")
    .eq("organization_id", organizationId)
    .eq("property_id", propertyId);

  if (error) throw error;

  return data ?? [];
}

export async function insertPropertyAssignment(
  organizationId: string,
  propertyId: string,
  userId: string,
  assignedBy: string | null
): Promise<PropertyAssignmentRow> {
  const { data, error } = await supabase
    .from("property_assignments")
    .insert({
      organization_id: organizationId,
      property_id: propertyId,
      user_id: userId,
      assigned_by: assignedBy,
    })
    .select("id, organization_id, property_id, user_id, assigned_by, created_at")
    .single();

  if (error) throw error;

  return data;
}

export async function deletePropertyAssignment(
  organizationId: string,
  propertyId: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("property_assignments")
    .delete()
    .eq("organization_id", organizationId)
    .eq("property_id", propertyId)
    .eq("user_id", userId)
    .select("id");

  if (error) throw error;

  return !!data && data.length > 0;
}
