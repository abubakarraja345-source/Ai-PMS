import { FunctionDeclaration, Type } from "@google/genai";

import { getReportsSummary } from "../reports/service";
import { getCleaningTasks } from "../cleaning/service";
import { getMaintenanceTickets } from "../maintenance/service";
import { listInventoryForOrganization } from "../inventory/service";
import { listIntegrations } from "../integrations/service";
import { getProperties } from "../properties/service";
import { getOrganizationSettings } from "../settings/service";
import { getReservations } from "../reservations/service";
import { findActiveAndUpcomingReservations } from "../reservations/repository";
import { getUnreadCount, listNotifications } from "../notifications/service";

import { CLEANING_STATUSES } from "../cleaning/validation";
import {
  MAINTENANCE_PRIORITIES,
  MAINTENANCE_STATUSES,
} from "../maintenance/validation";
import { RESERVATION_STATUSES } from "../reservations/validation";

import { monthBoundsUTC, todayUTC } from "./context";
import { ToolProposal } from "./types";

export interface ToolContext {
  organizationId: string;
  organizationName: string;
  userId: string;
}

type ToolExecutor = (
  args: Record<string, unknown>,
  ctx: ToolContext
) => Promise<Record<string, unknown>>;

function guestName(
  guest: { first_name: string; last_name: string | null } | null | undefined
): string {
  if (!guest) return "Unknown guest";
  return `${guest.first_name} ${guest.last_name ?? ""}`.trim();
}

function resolveDate(value: unknown): string {
  const today = todayUTC();

  if (typeof value !== "string" || !value.trim()) {
    return today;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "today") return today;

  if (normalized === "tomorrow") {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }

  return today;
}

/* ------------------------------------------------------------------ *
 * Read-only tools — every executor calls an existing service function
 * and maps the result down to a compact, PII-minimal shape. None of
 * these can write to the database.
 * ------------------------------------------------------------------ */

const getArrivalsDepartures: ToolExecutor = async (args, ctx) => {
  const date = resolveDate(args.date);
  const direction =
    args.direction === "checkin" || args.direction === "checkout"
      ? args.direction
      : "both";

  const today = todayUTC();
  const reservations = await findActiveAndUpcomingReservations(
    ctx.organizationId,
    date < today ? date : today
  );

  const arrivals =
    direction === "checkout"
      ? []
      : reservations.filter((r) => r.check_in === date);

  const departures =
    direction === "checkin"
      ? []
      : reservations.filter((r) => r.check_out === date);

  const map = (r: (typeof reservations)[number]) => ({
    property: r.property?.title ?? "Unknown property",
    guest: guestName(r.guest),
    checkIn: r.check_in,
    checkOut: r.check_out,
    status: r.status,
    source: r.source,
  });

  return {
    date,
    arrivals: arrivals.map(map),
    departures: departures.map(map),
  };
};

const getVacantProperties: ToolExecutor = async (_args, ctx) => {
  const today = todayUTC();

  const [properties, reservations] = await Promise.all([
    getProperties(ctx.organizationId),
    findActiveAndUpcomingReservations(ctx.organizationId, today),
  ]);

  // Same business rule as the dashboard summary: a property is
  // occupied "right now" if a confirmed/pending stay spans today.
  const occupiedPropertyIds = new Set(
    reservations
      .filter((r) => r.check_in <= today && r.check_out > today)
      .map((r) => r.property_id)
  );

  const activeProperties = properties.filter((p) => p.status === "active");

  return {
    date: today,
    vacantProperties: activeProperties
      .filter((p) => !occupiedPropertyIds.has(p.id))
      .map((p) => ({ id: p.id, title: p.title })),
    occupiedCount: occupiedPropertyIds.size,
    activeCount: activeProperties.length,
  };
};

const getReservationsList: ToolExecutor = async (args, ctx) => {
  const filters: { status?: string; propertyId?: string } = {};

  if (typeof args.status === "string") filters.status = args.status;
  if (typeof args.propertyId === "string") filters.propertyId = args.propertyId;

  const reservations = await getReservations(ctx.organizationId, filters);

  return {
    count: reservations.length,
    reservations: reservations.slice(0, 30).map((r) => ({
      property: r.property?.title ?? "Unknown property",
      guest: guestName(r.guest),
      checkIn: r.check_in,
      checkOut: r.check_out,
      status: r.status,
      source: r.source,
      totalAmount: r.total_amount,
      currency: r.currency,
      bookingReference: r.booking_reference,
    })),
  };
};

const getLowStockInventory: ToolExecutor = async (_args, ctx) => {
  const items = await listInventoryForOrganization(ctx.organizationId, {
    lowStockOnly: true,
  });

  return {
    count: items.length,
    items: items.slice(0, 30).map((i) => ({
      name: i.name,
      property: i.propertyTitle,
      quantity: i.quantity,
      minimumQuantity: i.minimumQuantity,
      unit: i.unit,
    })),
  };
};

const getCleaningTasksTool: ToolExecutor = async (args, ctx) => {
  const filters: { status?: (typeof CLEANING_STATUSES)[number] } = {};

  if (
    typeof args.status === "string" &&
    (CLEANING_STATUSES as readonly string[]).includes(args.status)
  ) {
    filters.status = args.status as (typeof CLEANING_STATUSES)[number];
  }

  const tasks = await getCleaningTasks(ctx.organizationId, filters);

  return {
    count: tasks.length,
    tasks: tasks.slice(0, 20).map((t) => ({
      property: t.property?.title ?? "Unknown property",
      status: t.status,
      priority: t.priority,
      scheduledDate: t.scheduled_date,
    })),
  };
};

const getMaintenanceTicketsTool: ToolExecutor = async (args, ctx) => {
  const filters: {
    status?: (typeof MAINTENANCE_STATUSES)[number];
    priority?: (typeof MAINTENANCE_PRIORITIES)[number];
  } = {};

  if (
    typeof args.status === "string" &&
    (MAINTENANCE_STATUSES as readonly string[]).includes(args.status)
  ) {
    filters.status = args.status as (typeof MAINTENANCE_STATUSES)[number];
  }

  if (
    typeof args.priority === "string" &&
    (MAINTENANCE_PRIORITIES as readonly string[]).includes(args.priority)
  ) {
    filters.priority = args.priority as (typeof MAINTENANCE_PRIORITIES)[number];
  }

  const tickets = await getMaintenanceTickets(ctx.organizationId, filters);

  return {
    count: tickets.length,
    tickets: tickets.slice(0, 20).map((t) => ({
      title: t.title,
      property: t.property?.title ?? "Unknown property",
      status: t.status,
      priority: t.priority,
    })),
  };
};

const getRevenueReport: ToolExecutor = async (args, ctx) => {
  const period = args.period === "lastMonth" ? 1 : 0;
  const range = monthBoundsUTC(period);

  const summary = await getReportsSummary(
    ctx.organizationId,
    range.start,
    range.end
  );

  return {
    period: summary.period,
    overview: summary.overview,
    bySource: summary.bookings.bySource,
    byStatus: summary.bookings.byStatus,
  };
};

const getPropertyPerformance: ToolExecutor = async (args, ctx) => {
  const period = args.period === "lastMonth" ? 1 : 0;
  const range = monthBoundsUTC(period);

  const summary = await getReportsSummary(
    ctx.organizationId,
    range.start,
    range.end
  );

  return {
    period: summary.period,
    properties: summary.properties.map((p) => ({
      title: p.title,
      reservationCount: p.reservationCount,
      revenue: p.revenue,
      occupancyRate: p.occupancy.occupancyRate,
    })),
  };
};

const getIntegrationsStatus: ToolExecutor = async (_args, ctx) => {
  const integrations = await listIntegrations(ctx.organizationId);

  return {
    integrations: integrations.map((i) => ({
      provider: i.provider,
      accountName: i.accountName,
      status: i.status,
      lastSyncAt: i.lastSyncAt,
      lastSuccessfulSyncAt: i.lastSuccessfulSyncAt,
    })),
  };
};

const getOrgSettings: ToolExecutor = async (_args, ctx) => {
  const settings = await getOrganizationSettings(ctx.organizationId);

  return {
    name: settings.name,
    timezone: settings.timezone,
    currency: settings.currency,
    language: settings.language,
    checkInTime: settings.checkInTime,
    checkOutTime: settings.checkOutTime,
  };
};

/* ------------------------------------------------------------------ *
 * Action-proposal tools. These NEVER write to the database — they
 * only resolve/validate the user's intent against real data and
 * return a `proposal` object. The orchestrator (service.ts) surfaces
 * that proposal to the frontend; only a separate, explicitly
 * user-confirmed request to POST /api/ai/actions/execute can trigger
 * the actual mutation (via the same existing service functions used
 * everywhere else), independently re-validated from scratch.
 * ------------------------------------------------------------------ */

const proposeInventoryAdjustment: ToolExecutor = async (args, ctx) => {
  const itemName = typeof args.itemName === "string" ? args.itemName.trim() : "";
  const quantityChange = Number(args.quantityChange);

  if (!itemName) {
    return { error: "itemName is required." };
  }

  if (!Number.isInteger(quantityChange) || quantityChange === 0) {
    return { error: "quantityChange must be a nonzero whole number." };
  }

  const matches = await listInventoryForOrganization(ctx.organizationId, {
    search: itemName,
  });

  if (matches.length === 0) {
    return { error: `No inventory item found matching "${itemName}".` };
  }

  if (matches.length > 1) {
    return {
      error:
        "Multiple items match that name — ask the user which one they mean.",
      candidates: matches.slice(0, 5).map((i) => ({
        name: i.name,
        property: i.propertyTitle,
        quantity: i.quantity,
      })),
    };
  }

  const item = matches[0]!;
  const resultingQuantity = item.quantity + quantityChange;

  if (resultingQuantity < 0) {
    return {
      error: `Cannot reduce "${item.name}" by ${Math.abs(quantityChange)} — only ${item.quantity} currently in stock.`,
    };
  }

  const proposal: ToolProposal = {
    type: "adjust_inventory",
    summary: `Adjust "${item.name}" at ${item.propertyTitle} by ${
      quantityChange > 0 ? "+" : ""
    }${quantityChange} (${item.quantity} → ${resultingQuantity}).`,
    params: {
      itemId: item.id,
      itemName: item.name,
      propertyTitle: item.propertyTitle,
      quantityChange,
      currentQuantity: item.quantity,
      resultingQuantity,
      reason: typeof args.reason === "string" ? args.reason : null,
      notes: typeof args.notes === "string" ? args.notes : null,
    },
  };

  return { proposal };
};

const proposeMarkNotificationRead: ToolExecutor = async (args, ctx) => {
  if (args.all === true) {
    const unread = await getUnreadCount(ctx.organizationId, ctx.userId);

    if (unread === 0) {
      return { error: "There are no unread notifications." };
    }

    const proposal: ToolProposal = {
      type: "mark_all_notifications_read",
      summary: `Mark all ${unread} unread notification${unread === 1 ? "" : "s"} as read.`,
      params: {},
    };

    return { proposal };
  }

  const notificationId =
    typeof args.notificationId === "string" ? args.notificationId.trim() : "";

  if (!notificationId) {
    return { error: "notificationId is required (or pass all: true)." };
  }

  const notifications = await listNotifications(
    ctx.organizationId,
    ctx.userId
  );
  const target = notifications.find((n) => n.id === notificationId);

  if (!target) {
    return { error: "Notification not found." };
  }

  if (target.isRead) {
    return { error: "That notification is already marked as read." };
  }

  const proposal: ToolProposal = {
    type: "mark_notification_read",
    summary: `Mark "${target.title}" as read.`,
    params: { notificationId: target.id },
  };

  return { proposal };
};

/* ------------------------------------------------------------------ */

const TOOL_EXECUTORS: Record<string, ToolExecutor> = {
  get_arrivals_departures: getArrivalsDepartures,
  get_vacant_properties: getVacantProperties,
  get_reservations: getReservationsList,
  get_low_stock_inventory: getLowStockInventory,
  get_cleaning_tasks: getCleaningTasksTool,
  get_maintenance_tickets: getMaintenanceTicketsTool,
  get_revenue_report: getRevenueReport,
  get_property_performance: getPropertyPerformance,
  get_integrations_status: getIntegrationsStatus,
  get_organization_settings: getOrgSettings,
  propose_inventory_adjustment: proposeInventoryAdjustment,
  propose_mark_notification_read: proposeMarkNotificationRead,
};

export const ACTION_PROPOSAL_TOOL_NAMES = new Set([
  "propose_inventory_adjustment",
  "propose_mark_notification_read",
]);

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<Record<string, unknown>> {
  const executor = TOOL_EXECUTORS[name];

  if (!executor) {
    return { error: `Unknown tool: ${name}` };
  }

  try {
    return await executor(args, ctx);
  } catch (error) {
    console.error(`AI tool "${name}" failed:`, error);
    return { error: "This lookup failed unexpectedly." };
  }
}

export const AI_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "get_arrivals_departures",
    description:
      "Get guest arrivals (check-ins) and departures (check-outs) for a specific date.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        date: {
          type: Type.STRING,
          description:
            'The date to check: "today", "tomorrow", or an explicit YYYY-MM-DD date. Defaults to today.',
        },
        direction: {
          type: Type.STRING,
          enum: ["checkin", "checkout", "both"],
          description: "Limit to arrivals only, departures only, or both (default).",
        },
      },
    },
  },
  {
    name: "get_vacant_properties",
    description:
      "List active properties that have no guest staying today (i.e. currently vacant).",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "get_reservations",
    description:
      "List reservations, optionally filtered by status or property.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        status: {
          type: Type.STRING,
          enum: [...RESERVATION_STATUSES],
          description: "Filter by reservation status.",
        },
        propertyId: {
          type: Type.STRING,
          description: "Filter to a specific property id.",
        },
      },
    },
  },
  {
    name: "get_low_stock_inventory",
    description:
      "List inventory items that are at or below their minimum stock level.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "get_cleaning_tasks",
    description: "List cleaning tasks, optionally filtered by status.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        status: { type: Type.STRING, enum: [...CLEANING_STATUSES] },
      },
    },
  },
  {
    name: "get_maintenance_tickets",
    description:
      "List maintenance tickets, optionally filtered by status and/or priority.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        status: { type: Type.STRING, enum: [...MAINTENANCE_STATUSES] },
        priority: { type: Type.STRING, enum: [...MAINTENANCE_PRIORITIES] },
      },
    },
  },
  {
    name: "get_revenue_report",
    description:
      "Get revenue, ADR, occupancy rate, cancellation rate, and booking-source/status breakdown for this month or last month.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        period: { type: Type.STRING, enum: ["thisMonth", "lastMonth"] },
      },
    },
  },
  {
    name: "get_property_performance",
    description:
      "Get per-property reservation count, revenue, and occupancy rate for this month or last month.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        period: { type: Type.STRING, enum: ["thisMonth", "lastMonth"] },
      },
    },
  },
  {
    name: "get_integrations_status",
    description:
      "Get the connection/sync status of every configured integration (iCal, Airbnb, Booking.com, VRBO, direct).",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "get_organization_settings",
    description:
      "Get the organization's name, timezone, currency, language, and check-in/check-out times.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "propose_inventory_adjustment",
    description:
      "Prepare (but do NOT execute) an inventory quantity adjustment for the user to confirm. Use this when the user asks to add/remove/use stock of an item.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        itemName: {
          type: Type.STRING,
          description: "The name (or partial name) of the inventory item.",
        },
        quantityChange: {
          type: Type.INTEGER,
          description:
            "Signed whole-number change, e.g. -2 to remove 2, +10 to add 10.",
        },
        reason: { type: Type.STRING },
        notes: { type: Type.STRING },
      },
      required: ["itemName", "quantityChange"],
    },
  },
  {
    name: "propose_mark_notification_read",
    description:
      "Prepare (but do NOT execute) marking one notification, or all notifications, as read for the user to confirm.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        notificationId: { type: Type.STRING },
        all: {
          type: Type.BOOLEAN,
          description: "Set true to mark every unread notification as read.",
        },
      },
    },
  },
];
