import { supabase } from "../../config/supabase";
import { AmenityRow, DocumentRow, RuleRow } from "./types";

/* ---------------------------- iCal export feed --------------------------- */

export async function setPropertyIcalExportTokenHash(
  organizationId: string,
  propertyId: string,
  tokenHash: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("properties")
    .update({ ical_export_token_hash: tokenHash })
    .eq("id", propertyId)
    .eq("organization_id", organizationId)
    .select("id");

  if (error) throw error;

  return !!data && data.length > 0;
}

export async function getPropertyIcalExportEnabled(
  organizationId: string,
  propertyId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("properties")
    .select("ical_export_token_hash")
    .eq("id", propertyId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) throw error;

  return !!data?.ical_export_token_hash;
}

/* ------------------------------- Amenities ------------------------------ */

const AMENITY_SELECT = "id, property_id, amenity_name, amenity_category, created_at";

export async function findAmenitiesByProperty(
  propertyId: string
): Promise<AmenityRow[]> {
  const { data, error } = await supabase
    .from("property_amenities")
    .select(AMENITY_SELECT)
    .eq("property_id", propertyId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return data ?? [];
}

export async function createAmenityRow(
  propertyId: string,
  name: string,
  category: string | null
): Promise<AmenityRow> {
  const { data, error } = await supabase
    .from("property_amenities")
    .insert({
      property_id: propertyId,
      amenity_name: name,
      amenity_category: category,
    })
    .select(AMENITY_SELECT)
    .single();

  if (error) throw error;

  return data;
}

export async function deleteAmenityRow(
  propertyId: string,
  amenityId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("property_amenities")
    .delete()
    .eq("id", amenityId)
    .eq("property_id", propertyId)
    .select("id");

  if (error) throw error;

  return !!data && data.length > 0;
}

/* ---------------------------------- Rules -------------------------------- */

const RULE_SELECT = "id, property_id, rule_title, rule_description, created_at";

export async function findRulesByProperty(
  propertyId: string
): Promise<RuleRow[]> {
  const { data, error } = await supabase
    .from("property_rules")
    .select(RULE_SELECT)
    .eq("property_id", propertyId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return data ?? [];
}

export async function findRuleById(
  propertyId: string,
  ruleId: string
): Promise<RuleRow | null> {
  const { data, error } = await supabase
    .from("property_rules")
    .select(RULE_SELECT)
    .eq("id", ruleId)
    .eq("property_id", propertyId)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function createRuleRow(
  propertyId: string,
  title: string,
  description: string | null
): Promise<RuleRow> {
  const { data, error } = await supabase
    .from("property_rules")
    .insert({
      property_id: propertyId,
      rule_title: title,
      rule_description: description,
    })
    .select(RULE_SELECT)
    .single();

  if (error) throw error;

  return data;
}

export async function updateRuleRow(
  propertyId: string,
  ruleId: string,
  updates: Record<string, unknown>
): Promise<RuleRow | null> {
  const { data, error } = await supabase
    .from("property_rules")
    .update(updates)
    .eq("id", ruleId)
    .eq("property_id", propertyId)
    .select(RULE_SELECT)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function deleteRuleRow(
  propertyId: string,
  ruleId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("property_rules")
    .delete()
    .eq("id", ruleId)
    .eq("property_id", propertyId)
    .select("id");

  if (error) throw error;

  return !!data && data.length > 0;
}

/* -------------------------------- Documents ------------------------------ */

const DOCUMENT_SELECT =
  "id, property_id, document_name, document_type, document_url, uploaded_by, created_at";

export async function findDocumentsByProperty(
  propertyId: string
): Promise<DocumentRow[]> {
  const { data, error } = await supabase
    .from("property_documents")
    .select(DOCUMENT_SELECT)
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

export async function findDocumentById(
  propertyId: string,
  documentId: string
): Promise<DocumentRow | null> {
  const { data, error } = await supabase
    .from("property_documents")
    .select(DOCUMENT_SELECT)
    .eq("id", documentId)
    .eq("property_id", propertyId)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function createDocumentRow(
  propertyId: string,
  uploadedBy: string,
  input: { path: string; name: string; documentType: string | null }
): Promise<DocumentRow> {
  const { data, error } = await supabase
    .from("property_documents")
    .insert({
      property_id: propertyId,
      document_name: input.name,
      document_type: input.documentType,
      document_url: input.path,
      uploaded_by: uploadedBy,
    })
    .select(DOCUMENT_SELECT)
    .single();

  if (error) throw error;

  return data;
}

export async function deleteDocumentRow(
  propertyId: string,
  documentId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("property_documents")
    .delete()
    .eq("id", documentId)
    .eq("property_id", propertyId)
    .select("id");

  if (error) throw error;

  return !!data && data.length > 0;
}

/** Every document path for a property — used to purge Storage
 * objects defensively when the property itself is deleted. */
export async function findDocumentPathsByProperty(
  propertyId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from("property_documents")
    .select("document_url")
    .eq("property_id", propertyId);

  if (error) throw error;

  return (data ?? []).map((row) => row.document_url);
}
