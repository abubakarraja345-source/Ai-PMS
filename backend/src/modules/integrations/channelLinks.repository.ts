import { supabase } from "../../config/supabase";
import { PropertyChannelLinkRow } from "./channelLinks.types";

const CHANNEL_LINK_SELECT =
  "id, organization_id, property_id, provider, external_listing_id, created_at, updated_at";

export async function findChannelLinksByOrganization(
  organizationId: string
): Promise<PropertyChannelLinkRow[]> {
  const { data, error } = await supabase
    .from("property_channel_links")
    .select(CHANNEL_LINK_SELECT)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return data ?? [];
}

export async function findChannelLinkById(
  organizationId: string,
  linkId: string
): Promise<PropertyChannelLinkRow | null> {
  const { data, error } = await supabase
    .from("property_channel_links")
    .select(CHANNEL_LINK_SELECT)
    .eq("id", linkId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) throw error;

  return data;
}

/**
 * Used by a future automated/scheduled sync to resolve "which property
 * does this provider + external listing ID belong to" without a
 * human picking it manually every run — not called by anything yet
 * (today's manual sync still takes propertyId from the caller), but
 * this is the lookup that capability will need.
 */
export async function findChannelLinkByExternalListing(
  organizationId: string,
  provider: string,
  externalListingId: string
): Promise<PropertyChannelLinkRow | null> {
  const { data, error } = await supabase
    .from("property_channel_links")
    .select(CHANNEL_LINK_SELECT)
    .eq("organization_id", organizationId)
    .eq("provider", provider)
    .eq("external_listing_id", externalListingId)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function insertChannelLink(
  organizationId: string,
  input: {
    propertyId: string;
    provider: string;
    externalListingId: string;
  }
): Promise<PropertyChannelLinkRow> {
  const { data, error } = await supabase
    .from("property_channel_links")
    .insert({
      organization_id: organizationId,
      property_id: input.propertyId,
      provider: input.provider,
      external_listing_id: input.externalListingId,
    })
    .select(CHANNEL_LINK_SELECT)
    .single();

  if (error) throw error;

  return data;
}

export async function deleteChannelLink(
  organizationId: string,
  linkId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("property_channel_links")
    .delete()
    .eq("id", linkId)
    .eq("organization_id", organizationId)
    .select("id");

  if (error) throw error;

  return !!data && data.length > 0;
}
