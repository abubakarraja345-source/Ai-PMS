import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware";
import { requireOrganization } from "../../middleware/organization.middleware";

import {
  getStatusController,
  linkConversationController,
  listConversationsController,
  listMessagesController,
  sendToConversationController,
  sendToGuestController,
} from "./controller";

const router = Router();

router.use(requireAuth, requireOrganization);

// Any org member can view/send guest messages — matches the existing
// read/write posture on guests and reservations themselves (front-
// desk staff routinely need to message guests), unlike the
// connection-management actions on the Airbnb/iCal integrations.
router.get("/status", getStatusController);
router.get("/conversations", listConversationsController);
router.get(
  "/conversations/:conversationId/messages",
  listMessagesController
);
router.post(
  "/conversations/:conversationId/messages",
  sendToConversationController
);
router.patch(
  "/conversations/:conversationId/link",
  linkConversationController
);
router.post("/guests/:guestId/messages", sendToGuestController);

export default router;
