import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireOrganization } from "../../middleware/organization.middleware";
import { aiChatRateLimiter } from "../../middleware/rateLimiter";

import {
  chatController,
  deleteConversationController,
  executeActionController,
  getConversationMessagesController,
  insightsController,
  listConversationsController,
} from "./controller";

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);

/**
 * No requireRole gate: the AI assistant is read-only by design (it
 * cannot create/edit/delete anything), so every organization role —
 * including member — gets the same access, matching how every other
 * GET/read endpoint in this codebase is open to all roles.
 */

// POST /api/ai/chat — extra rate limit on top of the global one,
// since each call spends real Gemini API quota.
router.post("/chat", aiChatRateLimiter, chatController);

// GET /api/ai/conversations
router.get("/conversations", listConversationsController);

// GET /api/ai/conversations/:id/messages
router.get("/conversations/:id/messages", getConversationMessagesController);

// DELETE /api/ai/conversations/:id
router.delete("/conversations/:id", deleteConversationController);

/**
 * POST /api/ai/actions/execute — the only endpoint that can mutate
 * data. No blanket requireRole here: allowed action types have
 * different authorization levels (e.g. adjust_inventory requires
 * owner/company_admin, matching the existing inventory routes;
 * mark_notification_read is open to any role, since it only touches
 * the caller's own notifications) — enforced per-action inside
 * executeAiAction, same layering the role.middleware.ts docstring
 * already establishes for resource-specific rules.
 */
router.post("/actions/execute", executeActionController);

// GET /api/ai/insights — deterministic, non-AI dashboard insights
router.get("/insights", insightsController);

export default router;
