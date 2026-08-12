import { supabase } from "../../../config/supabase";
import { IntegrationRow } from "../types";
import { AIRBNB_API_PROVIDER } from "./types";

const INTEGRATION_SELECT =
  "id, organization_id, provider, account_name, api_key, access_token, refresh_token, expires_at, status, created_at, property_id, external_listing_name, last_sync_started_at, last_sync_duration_ms, consecutive_failure_count, property:properties(id, title)";

/**
 * At most one Airbnb Official API connection is expected per
 * organization (a host authorizes one Airbnb account) — not enforced
 * by a DB constraint (the existing `integrations` table has none on
 * provider+organization either), just a service-layer convention:
 * the most recently created row wins if more than one somehow exists.
 * property_id is always null for this row — it's account-level, not
 * property-level; per-property mapping lives in property_channel_links
 * (see listAirbnbListingMappings below), exactly mirroring how the
 * existing iCal integrations already keep "the connection" and "which
 * property it's mapped to" conceptually separate.
 */
export async function findAirbnbApiConnection(
  organizationId: string
): Promise<IntegrationRow | null> {
  const { data, error } = await supabase
    .from("integrations")
    .select(INTEGRATION_SELECT)
    .eq("organization_id", organizationId)
    .eq("provider", AIRBNB_API_PROVIDER)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data as unknown as IntegrationRow | null;
}

export async function findAirbnbApiConnectionById(
  organizationId: string,
  integrationId: string
): Promise<IntegrationRow | null> {
  const { data, error } = await supabase
    .from("integrations")
    .select(INTEGRATION_SELECT)
    .eq("id", integrationId)
    .eq("organization_id", organizationId)
    .eq("provider", AIRBNB_API_PROVIDER)
    .maybeSingle();

  if (error) throw error;

  return data as unknown as IntegrationRow | null;
}

/**
 * Every enabled Airbnb-API connection across all organizations, for
 * the scheduler — the API-provider mirror of integrations/repository.
 * ts's findActiveConnectionsForSync. Filters on access_token (not
 * api_key, which iCal connections use) so this can never overlap with
 * — or be picked up by — the existing iCal scheduler's own query.
 */
export async function findActiveApiConnectionsForSync(): Promise<
  IntegrationRow[]
> {
  const { data, error } = await supabase
    .from("integrations")
    .select(INTEGRATION_SELECT)
    .eq("provider", AIRBNB_API_PROVIDER)
    .neq("status", "disabled")
    .not("access_token", "is", null);

  if (error) throw error;

  return (data ?? []) as unknown as IntegrationRow[];
}

/**
 * externalAccountId isn't persisted — the `integrations` table has no
 * dedicated column for it (external_listing_name is per-property,
 * meaningless for this property_id=null account-level row, and
 * account_name already carries the human-readable identity), and
 * nothing in this module needs to look a connection up BY external
 * account id — organization_id + provider already uniquely resolve
 * "this org's one Airbnb API connection".
 */
export async function createAirbnbApiConnection(
  organizationId: string,
  input: {
    accountName: string | null;
    accessToken: string;
    refreshToken: string | null;
    expiresAt: string | null;
  }
): Promise<IntegrationRow> {
  const { data, error } = await supabase
    .from("integrations")
    .insert({
      organization_id: organizationId,
      provider: AIRBNB_API_PROVIDER,
      account_name: input.accountName,
      access_token: input.accessToken,
      refresh_token: input.refreshToken,
      expires_at: input.expiresAt,
      property_id: null,
      status: "active",
    })
    .select(INTEGRATION_SELECT)
    .single();

  if (error) throw error;

  return data as unknown as IntegrationRow;
}

/* ------------------------- Listing mappings ------------------------- */
/* Reuses property_channel_links — the existing single source of truth
 * for property<->external-listing mapping — never a new table. See
 * Phase 6A architecture report. */

export interface AirbnbChannelLinkRow {
  id: string;
  organization_id: string;
  property_id: string;
  provider: string;
  external_listing_id: string;
  external_listing_name: string | null;
  created_at: string;
  updated_at: string;
}

const CHANNEL_LINK_SELECT =
  "id, organization_id, property_id, provider, external_listing_id, external_listing_name, created_at, updated_at";

export async function listAirbnbListingMappings(
  organizationId: string
): Promise<AirbnbChannelLinkRow[]> {
  const { data, error } = await supabase
    .from("property_channel_links")
    .select(CHANNEL_LINK_SELECT)
    .eq("organization_id", organizationId)
    .eq("provider", AIRBNB_API_PROVIDER)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return data ?? [];
}

export async function createAirbnbListingMapping(
  organizationId: string,
  input: {
    propertyId: string;
    externalListingId: string;
    externalListingName: string | null;
  }
): Promise<AirbnbChannelLinkRow> {
  const { data, error } = await supabase
    .from("property_channel_links")
    .insert({
      organization_id: organizationId,
      property_id: input.propertyId,
      provider: AIRBNB_API_PROVIDER,
      external_listing_id: input.externalListingId,
      external_listing_name: input.externalListingName,
    })
    .select(CHANNEL_LINK_SELECT)
    .single();

  if (error) throw error;

  return data;
}

/**
 * Same find-or-create-a-shared-placeholder pattern as
 * sync.repository.ts's findOrCreatePlaceholderGuest, kept as its own
 * small copy (different marker prefix: airbnb-api-import vs
 * ical-import) rather than parameterizing the existing iCal one —
 * used only when an Airbnb API reservation carries no guest name
 * (service.ts prefers creating a real, named guest when one is
 * available, unlike iCal feeds which never carry guest PII at all).
 */
export async function findOrCreateAirbnbPlaceholderGuest(
  organizationId: string,
  integrationId: string
): Promise<string> {
  const marker = `airbnb-api-import:${integrationId}`;

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
      first_name: "Imported (Airbnb)",
      notes: marker,
    })
    .select("id")
    .single();

  if (createError) throw createError;

  return created.id;
}

export async function deleteAirbnbListingMapping(
  organizationId: string,
  linkId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("property_channel_links")
    .delete()
    .eq("id", linkId)
    .eq("organization_id", organizationId)
    .eq("provider", AIRBNB_API_PROVIDER)
    .select("id");

  if (error) throw error;

  return !!data && data.length > 0;
}
