import {
  createIntegrationRow,
  deleteIntegrationRow,
  deleteSyncLogsByIntegration,
  findIntegrationById,
  findIntegrationsByOrganization,
  findLastSuccessfulSyncLog,
  findLastSyncLog,
  updateIntegrationRow,
} from "./repository";

import { Integration, IntegrationRow } from "./types";
import { CreateIntegrationInput, UpdateIntegrationInput } from "./validation";
import { getProviderAdapter } from "./providers/registry";
import { isSupportedProvider, ProviderId } from "./providers/types";
import {
  notifyIntegrationConnected,
  notifyIntegrationSyncFailed,
} from "../notifications/service";

async function toClientIntegration(row: IntegrationRow): Promise<Integration> {
  const [lastLog, lastSuccess] = await Promise.all([
    findLastSyncLog(row.id),
    findLastSuccessfulSyncLog(row.id),
  ]);

  const providerId = isSupportedProvider(row.provider) ? row.provider : null;
  const adapter = providerId ? getProviderAdapter(providerId) : null;

  return {
    id: row.id,
    provider: row.provider,
    accountName: row.account_name,
    status: row.status,
    hasFeedConfigured: !!row.api_key,
    isSupported: !!adapter?.isSupported,
    createdAt: row.created_at,
    lastSyncAt: lastLog?.synced_at ?? null,
    lastSuccessfulSyncAt: lastSuccess?.synced_at ?? null,
  };
}

export async function listIntegrations(
  organizationId: string
): Promise<Integration[]> {
  const rows = await findIntegrationsByOrganization(organizationId);

  return Promise.all(rows.map(toClientIntegration));
}

export async function getIntegration(
  organizationId: string,
  integrationId: string
): Promise<Integration | null> {
  const row = await findIntegrationById(organizationId, integrationId);

  return row ? toClientIntegration(row) : null;
}

export async function addIntegration(
  organizationId: string,
  input: CreateIntegrationInput
): Promise<Integration> {
  const row = await createIntegrationRow(organizationId, input);

  return toClientIntegration(row);
}

export async function editIntegration(
  organizationId: string,
  integrationId: string,
  updates: UpdateIntegrationInput
): Promise<Integration | null> {
  const dbUpdates: Record<string, unknown> = {};

  if (updates.accountName !== undefined)
    dbUpdates.account_name = updates.accountName;
  if (updates.feedUrl !== undefined) dbUpdates.api_key = updates.feedUrl;

  const updated = await updateIntegrationRow(
    organizationId,
    integrationId,
    dbUpdates
  );

  return updated ? toClientIntegration(updated) : null;
}

export async function removeIntegration(
  organizationId: string,
  integrationId: string
): Promise<boolean> {
  const existing = await findIntegrationById(organizationId, integrationId);

  if (!existing) {
    return false;
  }

  await deleteSyncLogsByIntegration(integrationId);

  return deleteIntegrationRow(organizationId, integrationId);
}

function assertAdapterAvailable(row: IntegrationRow) {
  if (!isSupportedProvider(row.provider)) {
    throw new Error(`Unknown provider: ${row.provider}`);
  }

  const adapter = getProviderAdapter(row.provider as ProviderId);

  if (!adapter) {
    throw new Error(
      `${row.provider} is not yet supported — no working adapter/credentials exist for this provider`
    );
  }

  return adapter;
}

export async function enableIntegration(
  organizationId: string,
  integrationId: string
): Promise<Integration | null> {
  const existing = await findIntegrationById(organizationId, integrationId);

  if (!existing) {
    return null;
  }

  assertAdapterAvailable(existing);

  if (!existing.api_key) {
    throw new Error("Configure a feed URL before enabling this integration");
  }

  const updated = await updateIntegrationRow(organizationId, integrationId, {
    status: "active",
  });

  return updated ? toClientIntegration(updated) : null;
}

export async function disableIntegration(
  organizationId: string,
  integrationId: string
): Promise<Integration | null> {
  const updated = await updateIntegrationRow(organizationId, integrationId, {
    status: "disabled",
  });

  return updated ? toClientIntegration(updated) : null;
}

export interface ConnectionTestResult {
  success: boolean;
  eventCount: number;
  errorMessage: string | null;
}

/**
 * Fetches and parses the configured feed without touching
 * reservations at all — safe to run regardless of whether this
 * integration is linked to a property.
 */
export async function testIntegrationConnection(
  organizationId: string,
  integrationId: string
): Promise<ConnectionTestResult> {
  const existing = await findIntegrationById(organizationId, integrationId);

  if (!existing) {
    throw new Error("Integration not found");
  }

  const adapter = assertAdapterAvailable(existing);

  if (!existing.api_key) {
    throw new Error("No feed URL configured");
  }

  const wasWorking = existing.status === "active";

  try {
    const events = await adapter.fetchEvents({ feedUrl: existing.api_key });

    await updateIntegrationRow(organizationId, integrationId, {
      status: "active",
    });

    if (!wasWorking) {
      await notifyIntegrationConnected(organizationId, {
        provider: existing.provider,
        accountName: existing.account_name,
      });
    }

    return { success: true, eventCount: events.length, errorMessage: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection failed";

    const wasAlreadyError = existing.status === "error";

    await updateIntegrationRow(organizationId, integrationId, {
      status: "error",
    });

    if (!wasAlreadyError) {
      await notifyIntegrationSyncFailed(organizationId, {
        provider: existing.provider,
        accountName: existing.account_name,
        errorMessage: message,
      });
    }

    return { success: false, eventCount: 0, errorMessage: message };
  }
}
