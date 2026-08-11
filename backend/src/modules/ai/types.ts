export interface AiConversationRow {
  id: string;
  organization_id: string;
  reservation_id: string | null;
  property_id: string | null;
  created_by: string | null;
  title: string | null;
  created_at: string;
}

export interface AiMessageRow {
  id: string;
  conversation_id: string;
  role: string;
  message: string;
  model: string | null;
  tokens: number | null;
  created_at: string;
}

export interface AiConversationSummary {
  id: string;
  title: string | null;
  createdAt: string;
}

export interface AiMessageSummary {
  id: string;
  role: string;
  message: string;
  model: string | null;
  createdAt: string;
}

export interface ToolProposal {
  type: string;
  summary: string;
  params: Record<string, unknown>;
}

export interface AiChatResult {
  conversationId: string;
  answer: string;
  contextUsed: string[];
  suggestions: string[];
  proposedAction: ToolProposal | null;
}

export type AiInsightSeverity = "info" | "warning" | "critical";

export interface AiInsight {
  type: string;
  severity: AiInsightSeverity;
  message: string;
}

export type AiActionStatus = "executed" | "rejected";

export interface AiActionAuditPayload {
  actionType: string;
  params: Record<string, unknown>;
  requestedBy: string;
  organizationId: string;
  status: AiActionStatus;
  result: unknown;
  error: string | null;
  executedAt: string;
}

export interface AiActionExecutionResult {
  status: AiActionStatus;
  result?: unknown;
}
