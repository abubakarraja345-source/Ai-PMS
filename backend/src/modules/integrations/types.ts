export interface IntegrationRow {
  id: string;
  organization_id: string;
  provider: string;
  account_name: string | null;
  api_key: string | null;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  status: string;
  created_at: string;
  property_id: string | null;
  external_listing_name: string | null;
  last_sync_started_at: string | null;
  last_sync_duration_ms: number | null;
  consecutive_failure_count: number;
  property?: { id: string; title: string } | null;
}

export type ConnectionHealth = "healthy" | "warning" | "error" | "disabled";

/** Client-facing shape — credentials are never returned, only a
 * boolean indicating whether one is configured. */
export interface Integration {
  id: string;
  provider: string;
  accountName: string | null;
  status: string;
  hasFeedConfigured: boolean;
  isSupported: boolean;
  createdAt: string;
  lastSyncAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastSyncError: string | null;
  propertyId: string | null;
  propertyTitle: string | null;
  externalListingName: string | null;
  health: ConnectionHealth;
  consecutiveFailureCount: number;
  lastSyncStartedAt: string | null;
  lastSyncDurationMs: number | null;
  nextScheduledSyncAt: string | null;
}

export interface SyncLogRow {
  id: string;
  integration_id: string;
  event: string;
  status: string;
  response: Record<string, unknown> | null;
  synced_at: string;
  started_at: string | null;
  duration_ms: number | null;
}

export interface SyncLogEntry {
  id: string;
  event: string;
  status: string;
  imported: number;
  updated: number;
  cancelled: number;
  skipped: number;
  conflicts: number;
  errorMessage: string | null;
  syncedAt: string;
  startedAt: string | null;
  durationMs: number | null;
}

export interface SyncResult {
  status: "success" | "failed";
  imported: number;
  updated: number;
  cancelled: number;
  skipped: number;
  conflicts: number;
  errorMessage: string | null;
  durationMs: number;
  health: ConnectionHealth;
  lastSuccessfulSyncAt: string | null;
}
