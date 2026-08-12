import { supabase } from "../../config/supabase";
import { IntegrationRow, SyncLogRow } from "./types";

const INTEGRATION_SELECT =
  "id, organization_id, provider, account_name, api_key, access_token, refresh_token, expires_at, status, created_at, property_id, external_listing_name, last_sync_started_at, last_sync_duration_ms, consecutive_failure_count, property:properties(id, title)";

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
 * Every property-linked, enabled, feed-configured connection across
 * ALL organizations — deliberately not organization-scoped, since
 * this backs the internal scheduler (a system process, not a user
 * request) rather than any API route. Never exported through a
 * controller. Each connection returned here is still synced through
 * runManualSync with its own organization_id, so every actual data
 * read/write during the sync itself remains fully organization-scoped
 * — only the "which connections exist to sync" query spans orgs.
 *
 * Includes status="error" as well as "active" — a connection that is
 * currently failing is still "enabled" (only "disabled" is excluded),
 * and it must keep being attempted or it could never recover. Only
 * "disabled" is ever excluded, exactly matching the "disabled
 * connections must never be automatically synced" requirement.
 */
export async function findActiveConnectionsForSync(): Promise<
  IntegrationRow[]
> {
  const { data, error } = await supabase
    .from("integrations")
    .select(INTEGRATION_SELECT)
    .neq("status", "disabled")
    .not("property_id", "is", null)
    .not("api_key", "is", null);

  if (error) throw error;

  return (data ?? []) as unknown as IntegrationRow[];
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

const SYNC_LOG_SELECT =
  "id, integration_id, event, status, response, synced_at, started_at, duration_ms";

export async function createSyncLogRow(
  integrationId: string,
  input: {
    event: string;
    status: string;
    response: Record<string, unknown>;
    startedAt?: string;
    durationMs?: number;
  }
): Promise<SyncLogRow> {
  const { data, error } = await supabase
    .from("sync_logs")
    .insert({
      integration_id: integrationId,
      event: input.event,
      status: input.status,
      response: input.response,
      started_at: input.startedAt ?? null,
      duration_ms: input.durationMs ?? null,
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
