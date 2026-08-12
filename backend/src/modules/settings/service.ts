import {
  findOrganizationById,
  findSettingsByOrganization,
  updateOrganizationName,
  upsertSettings,
} from "./repository";

import { OrganizationSettings } from "./types";
import { UpdateSettingsInput } from "./validation";
import { notifySettingsChanged } from "../notifications/service";
import { logAudit } from "../auditLog/service";

/**
 * organization_id/name live on `organizations` (already populated
 * per-org). Everything else lives on the separate `settings` table,
 * which starts with zero rows for every organization — a missing
 * row is not an error, it just means the org hasn't customized
 * these yet, so it degrades to the settings table's own column
 * defaults (UTC / USD / en / nulls), not to organizations.timezone
 * or organizations.currency. Keeping the two fully independent
 * avoids the two tables' timezone/currency values silently
 * drifting out of sync with each other.
 */
export async function getOrganizationSettings(
  organizationId: string
): Promise<OrganizationSettings> {
  const [org, settings] = await Promise.all([
    findOrganizationById(organizationId),
    findSettingsByOrganization(organizationId),
  ]);

  if (!org) {
    throw new Error("Organization not found");
  }

  const currency = settings?.currency ?? "USD";
  const baseCurrency = settings?.base_currency ?? currency;
  const displayCurrency = settings?.display_currency ?? baseCurrency;

  return {
    name: org.name,
    timezone: settings?.timezone ?? "UTC",
    currency,
    language: settings?.language ?? "en",
    checkInTime: settings?.check_in_time ?? null,
    checkOutTime: settings?.check_out_time ?? null,
    guestMessageTemplate: settings?.guest_message_template ?? null,
    baseCurrency,
    displayCurrency,
    exchangeRateMode: settings?.exchange_rate_mode ?? "auto",
    updatedAt: settings?.updated_at ?? null,
  };
}

export async function updateOrganizationSettings(
  organizationId: string,
  input: UpdateSettingsInput,
  actor?: { id: string; email?: string }
): Promise<OrganizationSettings> {
  const { name, ...settingsFields } = input;

  const previousCurrency =
    input.currency !== undefined
      ? (await getOrganizationSettings(organizationId)).currency
      : null;

  if (name !== undefined) {
    const updated = await updateOrganizationName(
      organizationId,
      name
    );

    if (!updated) {
      throw new Error("Organization not found");
    }
  }

  if (Object.keys(settingsFields).length > 0) {
    await upsertSettings(organizationId, settingsFields);
  }

  const changedFields = Object.keys(input);

  if (changedFields.length > 0) {
    await notifySettingsChanged(organizationId, changedFields);
  }

  if (input.currency !== undefined && input.currency !== previousCurrency) {
    void logAudit({
      organizationId,
      actorUserId: actor?.id ?? null,
      actorLabel: actor?.email ?? actor?.id ?? null,
      action: "currency.organization_changed",
      entityType: "organization",
      entityId: organizationId,
      metadata: { previousCurrency, newCurrency: input.currency },
    });
  }

  return getOrganizationSettings(organizationId);
}
