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

export interface OrganizationAssignmentSummaryRow {
  user_id: string;
  property_id: string;
  property_title: string;
}

/**
 * Every assignment across the whole organization, joined with the
 * property's title — backs the Team page's "assigned properties"
 * display (Phase 7.5). Gated the same as the member roster itself
 * (any authenticated org member — see organization/routes.ts's
 * GET /members comment on why viewing the roster isn't a "manage"
 * action).
 */
export async function findAllAssignmentsForOrganization(
  organizationId: string
): Promise<OrganizationAssignmentSummaryRow[]> {
  const { data, error } = await supabase
    .from("property_assignments")
    .select("user_id, property_id, properties(title)")
    .eq("organization_id", organizationId);

  if (error) throw error;

  return (data ?? []).map((row) => {
    const propertyRelation = row.properties as unknown as { title: string } | { title: string }[] | null;
    const title = Array.isArray(propertyRelation)
      ? (propertyRelation[0]?.title ?? "Unknown property")
      : (propertyRelation?.title ?? "Unknown property");

    return {
      user_id: row.user_id,
      property_id: row.property_id,
      property_title: title,
    };
  });
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
