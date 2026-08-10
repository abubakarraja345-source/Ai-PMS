import { supabase } from "../../config/supabase";

/**
 * Finds a reservation previously imported by this exact integration
 * for this exact external event — booking_reference is repurposed
 * to carry a namespaced `ical:{integrationId}:{externalId}` key,
 * since reservations has no dedicated external-id column. Scoped
 * by property_id + organization_id, so it can never match a
 * reservation outside this org/property.
 */
export async function findReservationByExternalRef(
  organizationId: string,
  propertyId: string,
  bookingReference: string
): Promise<{ id: string; check_in: string; check_out: string; status: string | null } | null> {
  const { data, error } = await supabase
    .from("reservations")
    .select("id, check_in, check_out, status")
    .eq("organization_id", organizationId)
    .eq("property_id", propertyId)
    .eq("booking_reference", bookingReference)
    .maybeSingle();

  if (error) throw error;

  return data;
}

/**
 * Find-or-create a single placeholder guest per integration, used
 * for imported bookings that carry no guest PII (the normal case
 * for OTA availability-block iCal feeds). `notes` is repurposed as
 * a hidden lookup marker so the same placeholder is reused across
 * syncs rather than creating a new guest every run.
 */
export async function findOrCreatePlaceholderGuest(
  organizationId: string,
  integrationId: string,
  label: string
): Promise<string> {
  const marker = `ical-import:${integrationId}`;

  const { data: existing, error: findError } = await supabase
    .from("guests")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("notes", marker)
    .maybeSingle();

  if (findError) throw findError;

  if (existing) {
    return existing.id;
  }

  const { data: created, error: createError } = await supabase
    .from("guests")
    .insert({
      organization_id: organizationId,
      first_name: `Imported (${label})`,
      notes: marker,
    })
    .select("id")
    .single();

  if (createError) throw createError;

  return created.id;
}
