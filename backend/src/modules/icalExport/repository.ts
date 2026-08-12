import { supabase } from "../../config/supabase";

export interface ExportablePropertyRow {
  id: string;
  title: string;
}

/**
 * Looked up by token hash only — deliberately not organization- or
 * property-ID-scoped, since this is a public feed where the token
 * itself is the entire authorization. Selecting only `id`/`title`
 * (never organization_id) keeps organization internals out of every
 * downstream value derived from this row.
 */
export async function findPropertyByExportTokenHash(
  tokenHash: string
): Promise<ExportablePropertyRow | null> {
  const { data, error } = await supabase
    .from("properties")
    .select("id, title")
    .eq("ical_export_token_hash", tokenHash)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export interface ExportableReservationRow {
  id: string;
  check_in: string;
  check_out: string;
  updated_at: string;
}

/**
 * Only the columns needed to build calendar-availability blocks.
 * Cancelled reservations are excluded — they don't occupy the
 * property, matching the same rule the rest of the app already uses
 * (reservations/repository.ts's findReservationsByOrganizationInRange).
 * No guest, financial, or contact information is selected at all.
 */
export async function findExportableReservations(
  propertyId: string
): Promise<ExportableReservationRow[]> {
  const { data, error } = await supabase
    .from("reservations")
    .select("id, check_in, check_out, updated_at")
    .eq("property_id", propertyId)
    .neq("status", "cancelled")
    .order("check_in", { ascending: true });

  if (error) throw error;

  return data ?? [];
}
