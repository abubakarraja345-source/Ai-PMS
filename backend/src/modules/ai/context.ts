import { getDashboardSummary } from "../../routes/dashboard.routes";
import { getReportsSummary } from "../reports/service";
import { listIntegrations } from "../integrations/service";
import { getProperties } from "../properties/service";
import { getOrganizationSettings } from "../settings/service";
import { getRange } from "../../utils/pagination";

/**
 * AI context/tool calls need "effectively everything for this org,"
 * not a user-facing page — this is a generous safety cap (not the
 * `parsePagination`/`MAX_LIMIT=100` clamp used for real pagination
 * requests), chosen to comfortably exceed any realistic single
 * organization's row count rather than to genuinely paginate.
 */
const AI_FETCH_RANGE = getRange(1, 500);

/** UTC month boundaries, matching dashboard.routes.ts's todayUTC()
 * convention and the frontend reports page's "this month" preset
 * (start = first of month, end = first of next month, exclusive). */
export function monthBoundsUTC(monthsAgo: number): { start: string; end: string } {
  const now = new Date();

  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 1)
  );

  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo + 1, 1)
  );

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface AiContextResult {
  context: Record<string, unknown>;
  sectionsUsed: string[];
}

/**
 * Always-included base context — small, aggregate-only, no PII.
 * Anything beyond this (specific reservations, low-stock item names,
 * open ticket lists, arrivals for a given date, etc.) is now fetched
 * on demand through Gemini function calling (see tools.ts) instead of
 * a keyword heuristic — the model asks for exactly what it needs for
 * the question at hand, per the "don't send the entire database"
 * requirement, without a fragile keyword-matching layer to maintain.
 */
export async function buildBaseContext(
  organizationId: string,
  organizationName: string
): Promise<AiContextResult> {
  const thisMonth = monthBoundsUTC(0);

  const [settings, dashboard, propertiesResult, integrations, reportsThisMonth] =
    await Promise.all([
      getOrganizationSettings(organizationId),
      getDashboardSummary(organizationId),
      getProperties(organizationId, AI_FETCH_RANGE),
      listIntegrations(organizationId),
      getReportsSummary(organizationId, thisMonth.start, thisMonth.end),
    ]);

  const properties = propertiesResult.data;

  const sectionsUsed: string[] = [];
  const context: Record<string, unknown> = {};

  context.organization = {
    name: organizationName,
    timezone: settings.timezone,
    currency: settings.currency,
    language: settings.language,
  };
  sectionsUsed.push("organization");

  context.properties = {
    total: properties.length,
    active: properties.filter(
      (p: { status: string | null }) => p.status === "active"
    ).length,
    list: properties.map(
      (p: { id: string; title: string; status: string | null }) => ({
        id: p.id,
        title: p.title,
        status: p.status,
      })
    ),
  };
  sectionsUsed.push("properties");

  context.reservationsSummary = {
    totalReservations: dashboard.stats.totalReservations,
    pendingReservations: dashboard.stats.pendingReservations,
    occupiedProperties: dashboard.occupancy.occupiedProperties,
    occupancyRate: dashboard.occupancy.occupancyRate,
    todayCheckInsCount: dashboard.today.checkIns.length,
    todayCheckOutsCount: dashboard.today.checkOuts.length,
    revenueByCurrency: dashboard.revenue.byCurrency,
  };
  sectionsUsed.push("reservationsSummary");

  context.guestsSummary = { total: dashboard.stats.totalGuests };
  sectionsUsed.push("guestsSummary");

  context.cleaning = dashboard.cleaning;
  sectionsUsed.push("cleaning");

  context.maintenance = dashboard.maintenance;
  sectionsUsed.push("maintenance");

  context.inventory = dashboard.inventory;
  sectionsUsed.push("inventory");

  context.integrations = {
    total: integrations.length,
    active: integrations.filter((i) => i.status === "active").length,
    error: integrations.filter((i) => i.status === "error").length,
  };
  sectionsUsed.push("integrations");

  context.reportsOverviewThisMonth = {
    period: reportsThisMonth.period,
    overview: reportsThisMonth.overview,
  };
  sectionsUsed.push("reportsOverviewThisMonth");

  return { context, sectionsUsed };
}
