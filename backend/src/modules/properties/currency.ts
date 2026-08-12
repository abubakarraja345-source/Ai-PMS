import { findPropertyById } from "./repository";
import { findSettingsByOrganization } from "../settings/repository";
import { DEFAULT_CURRENCY } from "../../constants/currency";

/**
 * property.currency ?? organization's default currency (settings.currency)
 * ?? DEFAULT_CURRENCY. The one centralized place this fallback chain is
 * computed — every caller that needs "what currency should this
 * property's money be in" must go through this function rather than
 * re-deriving it, so the rule can never drift between callers (e.g.
 * reservation creation vs. the property detail page's "Effective
 * currency" display).
 *
 * Returns null if the property doesn't exist in this organization —
 * callers that already verify property ownership separately (most of
 * them) will never see this; it's a defensive fallback, not the
 * primary authorization check.
 */
export async function getEffectivePropertyCurrency(
  organizationId: string,
  propertyId: string
): Promise<string> {
  const [property, settings] = await Promise.all([
    findPropertyById(organizationId, propertyId),
    findSettingsByOrganization(organizationId),
  ]);

  return (
    property?.currency ?? settings?.currency ?? DEFAULT_CURRENCY
  );
}
