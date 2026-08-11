import { Response } from "express";
import { OrganizationRequest } from "../../middleware/organization.middleware";

import {
  validateChatInput,
  validateConversationId,
  validateExecuteActionInput,
} from "./validation";

import {
  askAi,
  executeAiAction,
  getConversationMessages,
  getDashboardInsights,
  listConversations,
  removeConversation,
} from "./service";

/**
 * Our own thrown `Error`s carry safe, intentional messages; a raw
 * PostgrestError's `.message` can leak column/table names and must
 * not reach the client — same convention used across every other
 * module in this codebase.
 */
function toClientErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.name !== "PostgrestError") {
    return error.message;
  }

  return fallback;
}

export async function chatController(req: OrganizationRequest, res: Response) {
  try {
    if (!req.organization || !req.user) {
      return res.status(403).json({
        success: false,
        error: "Organization context is required",
      });
    }

    const { message, conversationId } = validateChatInput(req.body);

    const data = await askAi(
      req.organization.id,
      req.organization.name,
      req.user.id,
      message,
      conversationId
    );

    return res.json({ success: true, data });
  } catch (error) {
    console.error("AI chat error:", error);

    return res.status(400).json({
      success: false,
      error: toClientErrorMessage(error, "Failed to get an AI response"),
    });
  }
}

export async function listConversationsController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization || !req.user) {
      return res.status(403).json({
        success: false,
        error: "Organization context is required",
      });
    }

    const data = await listConversations(req.organization.id, req.user.id);

    return res.json({ success: true, data });
  } catch (error) {
    console.error("List AI conversations error:", error);

    return res.status(500).json({
      success: false,
      error: "Failed to load conversations",
    });
  }
}

export async function getConversationMessagesController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization || !req.user) {
      return res.status(403).json({
        success: false,
        error: "Organization context is required",
      });
    }

    const conversationId = validateConversationId(req.params.id);

    const data = await getConversationMessages(
      req.organization.id,
      req.user.id,
      conversationId
    );

    if (!data) {
      return res.status(404).json({
        success: false,
        error: "Conversation not found",
      });
    }

    return res.json({ success: true, data });
  } catch (error) {
    console.error("Get AI conversation messages error:", error);

    return res.status(400).json({
      success: false,
      error: toClientErrorMessage(error, "Failed to load conversation"),
    });
  }
}

export async function deleteConversationController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization || !req.user) {
      return res.status(403).json({
        success: false,
        error: "Organization context is required",
      });
    }

    const conversationId = validateConversationId(req.params.id);

    const deleted = await removeConversation(
      req.organization.id,
      req.user.id,
      conversationId
    );

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "Conversation not found",
      });
    }

    return res.json({
      success: true,
      message: "Conversation deleted successfully",
    });
  } catch (error) {
    console.error("Delete AI conversation error:", error);

    return res.status(400).json({
      success: false,
      error: toClientErrorMessage(error, "Failed to delete conversation"),
    });
  }
}

export async function executeActionController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization || !req.user) {
      return res.status(403).json({
        success: false,
        error: "Organization context is required",
      });
    }

    const { conversationId, actionType, params } = validateExecuteActionInput(
      req.body
    );

    const data = await executeAiAction(
      req.organization.id,
      req.user.id,
      req.organization.role,
      conversationId,
      actionType,
      params
    );

    return res.json({ success: true, data });
  } catch (error) {
    console.error("AI action execution error:", error);

    return res.status(400).json({
      success: false,
      error: toClientErrorMessage(error, "Failed to execute action"),
    });
  }
}

export async function insightsController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({
        success: false,
        error: "Organization context is required",
      });
    }

    const data = await getDashboardInsights(req.organization.id);

    return res.json({ success: true, data });
  } catch (error) {
    console.error("AI insights error:", error);

    return res.status(500).json({
      success: false,
      error: "Failed to load insights",
    });
  }
}
