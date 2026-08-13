import { supabase } from "../../config/supabase";
import { findAirbnbApiConnection } from "./airbnbApi/repository";
import { AIRBNB_API_PROVIDER } from "./airbnbApi/types";

export type ChannelSource = "official_api" | "ical" | "manual";

export interface PropertyChannelOverview {
  propertyId: string;
  propertyTitle: string;
  officialApi: {
    provider: "airbnb";
    connected: boolean;
    externalListingId: string;
  } | null;
  ical: {
    provider: string;
    integrationId: string;
    status: string;
  } | null;
  /**
   * Which source actually feeds this property's reservations today.
   * "official_api" wins whenever both are present — matches the
   * sync-side merge policy in airbnbApi/service.ts (official API data
   * is preferred; a matching iCal-sourced booking gets adopted rather
   * than duplicated). "manual" means no channel is connected at all —
   * the property is managed entirely by hand in the PMS.
   */
  effectiveSource: ChannelSource;
}

/**
 * Phase 6B — a single per-property read combining two independently-
 * built connection systems (the account-level Airbnb Official API
 * mapping via property_channel_links, and the existing per-property
 * iCal `integrations` rows) so the UI can show one unambiguous answer
 * to "how is this property connected?" instead of the user having to
 * cross-reference two separate screens. Read-only — never writes
 * anything, so no RBAC beyond normal org membership is required (same
 * view-level gate as GET /api/integrations and GET .../airbnb/status).
 */
export async function getChannelOverview(
  organizationId: string
): Promise<PropertyChannelOverview[]> {
  const [{ data: properties, error: propertiesError }, apiConnection] =
    await Promise.all([
      supabase
        .from("properties")
        .select("id, title")
        .eq("organization_id", organizationId)
        .order("title", { ascending: true }),
      findAirbnbApiConnection(organizationId),
    ]);

  if (propertiesError) throw propertiesError;

  const apiConnected = !!apiConnection && apiConnection.status !== "disabled";

  const [{ data: apiLinks, error: linksError }, { data: icalRows, error: icalError }] =
    await Promise.all([
      supabase
        .from("property_channel_links")
        .select("property_id, external_listing_id")
        .eq("organization_id", organizationId)
        .eq("provider", AIRBNB_API_PROVIDER),
      supabase
        .from("integrations")
        .select("id, provider, property_id, status")
        .eq("organization_id", organizationId)
        .neq("provider", AIRBNB_API_PROVIDER)
        .not("property_id", "is", null),
    ]);

  if (linksError) throw linksError;
  if (icalError) throw icalError;

  const apiLinkByProperty = new Map(
    (apiLinks ?? []).map((l) => [l.property_id as string, l])
  );
  const icalByProperty = new Map(
    (icalRows ?? []).map((r) => [r.property_id as string, r])
  );

  return (properties ?? []).map((property) => {
    const apiLink = apiLinkByProperty.get(property.id);
    const icalRow = icalByProperty.get(property.id);

    const officialApi = apiLink
      ? {
          provider: "airbnb" as const,
          connected: apiConnected,
          externalListingId: apiLink.external_listing_id as string,
        }
      : null;

    const ical = icalRow
      ? {
          provider: icalRow.provider as string,
          integrationId: icalRow.id as string,
          status: icalRow.status as string,
        }
      : null;

    let effectiveSource: ChannelSource = "manual";
    if (officialApi?.connected) {
      effectiveSource = "official_api";
    } else if (ical && ical.status !== "disabled") {
      effectiveSource = "ical";
    }

    return {
      propertyId: property.id,
      propertyTitle: property.title,
      officialApi,
      ical,
      effectiveSource,
    };
  });
}
