import { getDashboardSummary } from "../../routes/dashboard.routes";
import { getReportsSummary } from "../reports/service";
import { listIntegrations } from "../integrations/service";
import { adjustInventoryStock } from "../inventory/service";
import { findItemByIdForOrganization } from "../inventory/repository";
import { markAllAsRead, markAsRead } from "../notifications/service";
import { OrganizationRole } from "../../middleware/organization.middleware";

import { buildBaseContext, monthBoundsUTC } from "./context";
import {
  aiProvider,
  Content,
  GEMINI_MODEL,
  Part,
} from "./provider";
import { ACTION_PROPOSAL_TOOL_NAMES, AI_TOOL_DECLARATIONS, executeTool } from "./tools";

import {
  createConversationRow,
  createMessageRow,
  deleteConversationRow,
  deleteMessagesByConversation,
  findConversationById,
  findConversationsByUser,
  findMessagesByConversation,
} from "./repository";

import {
  AiActionAuditPayload,
  AiActionExecutionResult,
  AiChatResult,
  AiConversationSummary,
  AiInsight,
  AiMessageSummary,
  ToolProposal,
} from "./types";

const MAX_HISTORY_MESSAGES = 20;
const MAX_TOOL_ITERATIONS = 6;
const TITLE_MAX_LENGTH = 60;

const SUGGESTED_PROMPTS = [
  "What check-ins do I have today?",
  "Which properties are vacant?",
  "What inventory is low?",
  "What maintenance issues are open?",
  "How is occupancy this month?",
  "Which property generated the most revenue?",
  "Are any integrations failing?",
];

function buildSystemInstruction(
  organizationName: string,
  baseContext: Record<string, unknown>
): string {
  return [
    `You are a PMS operations assistant for the organization "${organizationName}".`,
    "You answer using ONLY: (1) the base context JSON below, and (2) the results of the tools you call. Never invent, guess, or assume a number, name, or fact.",
    "If a question needs more detail than the base context has, call the relevant tool instead of guessing.",
    "If neither the context nor any tool can answer the question, say so explicitly.",
    "You are read-only for everything except two actions: adjusting inventory and marking notifications read. For those, call the matching propose_* tool — it will NOT execute anything, it only prepares a proposal that the user must explicitly confirm in the UI. Never claim an action has been completed — only that it has been proposed/prepared.",
    "Keep answers concise and concrete, preferring specific numbers from the data over vague language.",
    "Revenue figures are grouped by currency — never add amounts from different currencies together.",
    "",
    "BASE CONTEXT:",
    JSON.stringify(baseContext),
  ].join("\n");
}

function deriveTitle(message: string): string {
  const trimmed = message.trim();

  return trimmed.length > TITLE_MAX_LENGTH
    ? `${trimmed.slice(0, TITLE_MAX_LENGTH - 1)}…`
    : trimmed;
}

function isProposal(value: unknown): value is ToolProposal {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as ToolProposal).type === "string" &&
    typeof (value as ToolProposal).summary === "string"
  );
}

export async function askAi(
  organizationId: string,
  organizationName: string,
  userId: string,
  message: string,
  conversationId: string | null
): Promise<AiChatResult> {
  if (!aiProvider.isConfigured()) {
    throw new Error(
      "The AI assistant is not configured yet — add a GEMINI_API_KEY to enable it."
    );
  }

  let conversation;

  if (conversationId) {
    conversation = await findConversationById(
      organizationId,
      userId,
      conversationId
    );

    if (!conversation) {
      throw new Error("Conversation not found");
    }
  } else {
    conversation = await createConversationRow(
      organizationId,
      userId,
      deriveTitle(message)
    );
  }

  const priorMessages = await findMessagesByConversation(
    conversation.id,
    MAX_HISTORY_MESSAGES
  );

  // Only real user/model turns are valid conversation history for the
  // model — action-audit rows are a UI/audit concern, not a chat turn.
  const contents: Content[] = priorMessages
    .filter((m) => m.role === "user" || m.role === "model")
    .map((m) => ({
      role: m.role as "user" | "model",
      parts: [{ text: m.message }],
    }));

  contents.push({ role: "user", parts: [{ text: message }] });

  const { context: baseContext, sectionsUsed } = await buildBaseContext(
    organizationId,
    organizationName
  );

  const systemInstruction = buildSystemInstruction(organizationName, baseContext);

  const toolsUsed: string[] = [];
  let proposedAction: ToolProposal | null = null;
  let finalText = "";
  let totalTokens = 0;

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const turn = await aiProvider.generateTurn(
      systemInstruction,
      contents,
      AI_TOOL_DECLARATIONS
    );

    totalTokens += turn.tokens ?? 0;

    if (turn.functionCalls.length === 0) {
      finalText = turn.text ?? "";
      break;
    }

    if (turn.modelContent) {
      contents.push(turn.modelContent);
    }

    const responseParts: Part[] = [];
    let stopAfterThisTurn = false;

    for (const call of turn.functionCalls) {
      const name = call.name ?? "";
      toolsUsed.push(name);

      const output = await executeTool(name, call.args ?? {}, {
        organizationId,
        organizationName,
        userId,
      });

      if (ACTION_PROPOSAL_TOOL_NAMES.has(name) && isProposal(output.proposal)) {
        proposedAction = output.proposal;
        stopAfterThisTurn = true;
      }

      responseParts.push({
        functionResponse: { name, response: output },
      });
    }

    contents.push({ role: "user", parts: responseParts });

    if (stopAfterThisTurn) {
      const closing = await aiProvider.generateTurn(systemInstruction, contents, []);
      totalTokens += closing.tokens ?? 0;
      finalText = closing.text ?? "";
      break;
    }
  }

  if (!finalText.trim()) {
    finalText =
      "I wasn't able to finish answering that — try rephrasing your question.";
  }

  await createMessageRow(conversation.id, "user", message, null, null);

  await createMessageRow(
    conversation.id,
    "model",
    finalText,
    GEMINI_MODEL,
    totalTokens || null
  );

  return {
    conversationId: conversation.id,
    answer: finalText,
    contextUsed: [...sectionsUsed, ...Array.from(new Set(toolsUsed))],
    suggestions: SUGGESTED_PROMPTS,
    proposedAction,
  };
}

export async function listConversations(
  organizationId: string,
  userId: string
): Promise<AiConversationSummary[]> {
  const rows = await findConversationsByUser(organizationId, userId);

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    createdAt: r.created_at,
  }));
}

export async function getConversationMessages(
  organizationId: string,
  userId: string,
  conversationId: string
): Promise<AiMessageSummary[] | null> {
  const conversation = await findConversationById(
    organizationId,
    userId,
    conversationId
  );

  if (!conversation) {
    return null;
  }

  const rows = await findMessagesByConversation(conversationId, 200);

  return rows.map((m) => ({
    id: m.id,
    role: m.role,
    message: m.message,
    model: m.model,
    createdAt: m.created_at,
  }));
}

export async function removeConversation(
  organizationId: string,
  userId: string,
  conversationId: string
): Promise<boolean> {
  const conversation = await findConversationById(
    organizationId,
    userId,
    conversationId
  );

  if (!conversation) {
    return false;
  }

  await deleteMessagesByConversation(conversationId);

  return deleteConversationRow(organizationId, userId, conversationId);
}

/* ------------------------------------------------------------------ *
 * Action execution — the ONLY path that can actually mutate data.
 * Every field of `params` is independently re-validated here; nothing
 * about a prior AI proposal is trusted. Authorization mirrors each
 * action's existing dedicated endpoint exactly (e.g. inventory
 * adjustment still requires owner/company_admin, same as
 * POST /api/properties/:id/inventory/:itemId/adjust).
 * ------------------------------------------------------------------ */

const KNOWN_ACTION_TYPES = new Set([
  "adjust_inventory",
  "mark_notification_read",
  "mark_all_notifications_read",
]);

export async function executeAiAction(
  organizationId: string,
  userId: string,
  userRole: OrganizationRole,
  conversationId: string,
  actionType: string,
  params: Record<string, unknown>
): Promise<AiActionExecutionResult> {
  const conversation = await findConversationById(
    organizationId,
    userId,
    conversationId
  );

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  if (!KNOWN_ACTION_TYPES.has(actionType)) {
    throw new Error(`Unknown action type: ${actionType}`);
  }

  let status: "executed" | "rejected" = "rejected";
  let result: unknown = null;
  let error: string | null = null;

  try {
    if (actionType === "adjust_inventory") {
      if (userRole !== "owner" && userRole !== "company_admin") {
        throw new Error("You do not have permission to adjust inventory");
      }

      const itemId = typeof params.itemId === "string" ? params.itemId : "";
      const quantityChange = Number(params.quantityChange);

      if (!itemId) {
        throw new Error("itemId is required");
      }

      if (!Number.isInteger(quantityChange) || quantityChange === 0) {
        throw new Error("quantityChange must be a nonzero whole number");
      }

      const item = await findItemByIdForOrganization(organizationId, itemId);

      if (!item) {
        throw new Error("Inventory item not found in your organization");
      }

      const updated = await adjustInventoryStock(
        organizationId,
        item.property_id,
        itemId,
        userId,
        {
          quantityChange,
          reason:
            typeof params.reason === "string" && params.reason.trim()
              ? params.reason.trim()
              : "ai_assistant",
          notes:
            typeof params.notes === "string" && params.notes.trim()
              ? `AI Assistant: ${params.notes.trim()}`
              : "Adjusted via AI Assistant (confirmed by user)",
        }
      );

      if (!updated) {
        throw new Error("Inventory item not found");
      }

      result = updated;
      status = "executed";
    } else if (actionType === "mark_notification_read") {
      const notificationId =
        typeof params.notificationId === "string" ? params.notificationId : "";

      if (!notificationId) {
        throw new Error("notificationId is required");
      }

      const updated = await markAsRead(organizationId, userId, notificationId);

      if (!updated) {
        throw new Error("Notification not found");
      }

      result = updated;
      status = "executed";
    } else {
      // mark_all_notifications_read
      const count = await markAllAsRead(organizationId, userId);
      result = { markedCount: count };
      status = "executed";
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "Action failed";
    status = "rejected";
  }

  const audit: AiActionAuditPayload = {
    actionType,
    params,
    requestedBy: userId,
    organizationId,
    status,
    result,
    error,
    executedAt: new Date().toISOString(),
  };

  await createMessageRow(
    conversation.id,
    "action_audit",
    JSON.stringify(audit),
    null,
    null
  );

  if (status === "rejected") {
    throw new Error(error ?? "Action failed");
  }

  return { status, result };
}

/* ------------------------------------------------------------------ *
 * Dashboard AI Insights — deterministic, no model call, so it works
 * even without a configured AI provider. Only emits an entry when
 * there's real data to flag; never fabricates a trend from
 * insufficient data (e.g. revenue comparisons are skipped entirely
 * unless both months have at least one reservation).
 * ------------------------------------------------------------------ */

export async function getDashboardInsights(
  organizationId: string
): Promise<AiInsight[]> {
  const thisMonth = monthBoundsUTC(0);
  const lastMonth = monthBoundsUTC(1);

  const [dashboard, integrations, reportsThisMonth, reportsLastMonth] =
    await Promise.all([
      getDashboardSummary(organizationId),
      listIntegrations(organizationId),
      getReportsSummary(organizationId, thisMonth.start, thisMonth.end),
      getReportsSummary(organizationId, lastMonth.start, lastMonth.end),
    ]);

  const insights: AiInsight[] = [];

  if (dashboard.inventory.lowStockCount > 0) {
    const n = dashboard.inventory.lowStockCount;

    insights.push({
      type: "inventory_low_stock",
      severity: "warning",
      message: `${n} inventory item${n === 1 ? "" : "s"} at or below minimum stock.`,
    });
  }

  if (dashboard.maintenance.urgent > 0) {
    const n = dashboard.maintenance.urgent;

    insights.push({
      type: "maintenance_urgent",
      severity: "critical",
      message: `${n} urgent maintenance ticket${n === 1 ? "" : "s"} still unresolved.`,
    });
  } else {
    const openCount = dashboard.maintenance.open + dashboard.maintenance.inProgress;

    if (openCount > 0) {
      insights.push({
        type: "maintenance_open",
        severity: "info",
        message: `${openCount} maintenance ticket${openCount === 1 ? "" : "s"} open or in progress.`,
      });
    }
  }

  if (dashboard.cleaning.pending > 0) {
    const n = dashboard.cleaning.pending;

    insights.push({
      type: "cleaning_pending",
      severity: dashboard.cleaning.pending > 5 ? "warning" : "info",
      message: `${n} cleaning task${n === 1 ? "" : "s"} pending.`,
    });
  }

  const failingIntegrations = integrations.filter((i) => i.status === "error");

  if (failingIntegrations.length > 0) {
    const n = failingIntegrations.length;
    const names = failingIntegrations.map((i) => i.provider).join(", ");

    insights.push({
      type: "integration_error",
      severity: "warning",
      message: `${n} integration${n === 1 ? "" : "s"} reporting sync errors (${names}).`,
    });
  }

  const checkIns = dashboard.today.checkIns.length;
  const checkOuts = dashboard.today.checkOuts.length;

  if (checkIns > 0 || checkOuts > 0) {
    insights.push({
      type: "todays_activity",
      severity: "info",
      message: `${checkIns} check-in${checkIns === 1 ? "" : "s"} and ${checkOuts} check-out${checkOuts === 1 ? "" : "s"} today.`,
    });
  }

  if (dashboard.occupancy.activeProperties > 0) {
    insights.push({
      type: "occupancy_rate",
      severity: dashboard.occupancy.occupancyRate === 0 ? "warning" : "info",
      message: `Occupancy is ${dashboard.occupancy.occupancyRate}% (${dashboard.occupancy.occupiedProperties} of ${dashboard.occupancy.activeProperties} active properties).`,
    });
  }

  // Revenue trend: only compare months that both actually have
  // reservations — otherwise a 0-reservation month makes any
  // percentage meaningless (division by zero, or a fabricated
  // "+infinite%" swing from a single booking).
  for (const thisEntry of reportsThisMonth.revenue.byCurrency) {
    const lastEntry = reportsLastMonth.revenue.byCurrency.find(
      (r) => r.currency === thisEntry.currency
    );

    if (!lastEntry || lastEntry.total === 0) continue;

    const change = Math.round(
      ((thisEntry.total - lastEntry.total) / lastEntry.total) * 1000
    ) / 10;

    if (change === 0) continue;

    insights.push({
      type: "revenue_trend",
      severity: "info",
      message: `${thisEntry.currency} revenue is ${change > 0 ? "up" : "down"} ${Math.abs(change)}% vs last month (${thisEntry.total} vs ${lastEntry.total}).`,
    });
  }

  return insights;
}
