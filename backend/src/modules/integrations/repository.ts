import { supabase } from "../../config/supabase";
import { IntegrationRow, SyncLogRow } from "./types";

const INTEGRATION_SELECT =
  "id, organization_id, provider, account_name, api_key, access_token, refresh_token, expires_at, status, created_at, property_id, external_listing_name, property:properties(id, title)";

export async function findIntegrationsByOrganization(
  organizationId: string
): Promise<IntegrationRow[]> {
  const { data, error } = await supabase
    .from("integrations")
    .select(INTEGRATION_SELECT)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  /*
   * Supabase's untyped client (no Database generic passed to
   * createClient) infers embedded relations as arrays by default. At
   * runtime PostgREST returns a single object here because
   * property_id is a many-to-one FK — this assertion aligns the type
   * with actual behavior (same pattern already used in
   * reservations/repository.ts).
   */
  return (data ?? []) as unknown as IntegrationRow[];
}

export async function findIntegrationById(
  organizationId: string,
  integrationId: string
): Promise<IntegrationRow | null> {
  const { data, error } = await supabase
    .from("integrations")
    .select(INTEGRATION_SELECT)
    .eq("id", integrationId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) throw error;

  return data as unknown as IntegrationRow | null;
}

/**
 * `feedUrl` is stored in the existing `api_key` column — an iCal
 * feed URL typically embeds an unguessable access token in its
 * query string, functioning as a credential, and no dedicated
 * "config" column exists on this table. Never returned verbatim to
 * the client (see service.ts's client-facing mapping).
 */
export async function createIntegrationRow(
  organizationId: string,
  input: {
    provider: string;
    accountName: string | null;
    feedUrl: string | null;
    propertyId?: string | null;
    externalListingName?: string | null;
  }
): Promise<IntegrationRow> {
  const { data, error } = await supabase
    .from("integrations")
    .insert({
      organization_id: organizationId,
      provider: input.provider,
      account_name: input.accountName,
      api_key: input.feedUrl,
      property_id: input.propertyId ?? null,
      external_listing_name: input.externalListingName ?? null,
      status: "disabled",
    })
    .select(INTEGRATION_SELECT)
    .single();

  if (error) throw error;

  return data as unknown as IntegrationRow;
}

export async function updateIntegrationRow(
  organizationId: string,
  integrationId: string,
  updates: Record<string, unknown>
): Promise<IntegrationRow | null> {
  const { data, error } = await supabase
    .from("integrations")
    .update(updates)
    .eq("id", integrationId)
    .eq("organization_id", organizationId)
    .select(INTEGRATION_SELECT)
    .maybeSingle();

  if (error) throw error;

  return data as unknown as IntegrationRow | null;
}

export async function deleteIntegrationRow(
  organizationId: string,
  integrationId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("integrations")
    .delete()
    .eq("id", integrationId)
    .eq("organization_id", organizationId)
    .select("id");

  if (error) throw error;

  return !!data && data.length > 0;
}

/* -------------------------------- Sync logs ------------------------------- */

const SYNC_LOG_SELECT = "id, integration_id, event, status, response, synced_at";

export async function createSyncLogRow(
  integrationId: string,
  input: { event: string; status: string; response: Record<string, unknown> }
): Promise<SyncLogRow> {
  const { data, error } = await supabase
    .from("sync_logs")
    .insert({
      integration_id: integrationId,
      event: input.event,
      status: input.status,
      response: input.response,
    })
    .select(SYNC_LOG_SELECT)
    .single();

  if (error) throw error;

  return data;
}

export async function findSyncLogsByIntegration(
  integrationId: string,
  limit = 50
): Promise<SyncLogRow[]> {
  const { data, error } = await supabase
    .from("sync_logs")
    .select(SYNC_LOG_SELECT)
    .eq("integration_id", integrationId)
    .order("synced_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return data ?? [];
}

export async function findLastSyncLog(
  integrationId: string
): Promise<SyncLogRow | null> {
  const { data, error } = await supabase
    .from("sync_logs")
    .select(SYNC_LOG_SELECT)
    .eq("integration_id", integrationId)
    .order("synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function findLastFailedSyncLog(
  integrationId: string
): Promise<SyncLogRow | null> {
  const { data, error } = await supabase
    .from("sync_logs")
    .select(SYNC_LOG_SELECT)
    .eq("integration_id", integrationId)
    .eq("status", "failed")
    .order("synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function findLastSuccessfulSyncLog(
  integrationId: string
): Promise<SyncLogRow | null> {
  const { data, error } = await supabase
    .from("sync_logs")
    .select(SYNC_LOG_SELECT)
    .eq("integration_id", integrationId)
    .eq("status", "success")
    .order("synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function deleteSyncLogsByIntegration(
  integrationId: string
): Promise<void> {
  const { error } = await supabase
    .from("sync_logs")
    .delete()
    .eq("integration_id", integrationId);

  if (error) throw error;
}
