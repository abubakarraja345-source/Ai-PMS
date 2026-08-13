import { Router } from "express";

import {
  whatsappWebhookReceiveController,
  whatsappWebhookVerifyController,
} from "./controller";

/**
 * Deliberately its own router, mounted separately from routes.ts and
 * NEVER behind requireAuth/requireOrganization — Meta calls these
 * directly and unauthenticated. verifyWebhookSignature (adapter.ts)
 * is the actual security boundary for the POST handler.
 */
const router = Router();

router.get("/", whatsappWebhookVerifyController);
router.post("/", whatsappWebhookReceiveController);

export default router;
