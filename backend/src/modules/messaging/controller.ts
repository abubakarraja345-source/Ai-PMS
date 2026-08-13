import { Request, Response } from "express";
import { OrganizationRequest } from "../../middleware/organization.middleware";
import { env } from "../../config/env";
import { getMessagingAdapter } from "./registry";
import { MessagingChannel } from "./types";

import {
  getChannelConfigStatus,
  listConversations,
  listMessages,
  linkConversation,
  sendMessageToConversation,
  sendMessageToGuest,
  ingestWebhook,
} from "./service";

import { validateLinkConversation, validateSendMessage } from "./validation";

function isKnownError(error: unknown): error is Error {
  return error instanceof Error && error.name !== "PostgrestError";
}

export async function getStatusController(
  req: OrganizationRequest,
  res: Response
) {
  if (!req.organization) {
    return res.status(403).json({
      success: false,
      error: "Organization context is required",
    });
  }

  const status = getChannelConfigStatus("whatsapp");

  return res.status(200).json({ success: true, data: status });
}

export async function listConversationsController(
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

    const data = await listConversations(req.organization.id);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("List conversations error:", error);
    return res.status(500).json({
      success: false,
      error: "Unable to load conversations",
    });
  }
}

export async function listMessagesController(
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

    const data = await listMessages(
      req.organization.id,
      req.params.conversationId as string
    );

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("List messages error:", error);

    if (isKnownError(error)) {
      return res.status(404).json({ success: false, error: error.message });
    }

    return res.status(500).json({
      success: false,
      error: "Unable to load messages",
    });
  }
}

export async function sendToConversationController(
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

    const input = validateSendMessage(req.body);

    const message = await sendMessageToConversation(
      req.organization.id,
      req.user,
      req.params.conversationId as string,
      input.body
    );

    return res.status(201).json({ success: true, data: message });
  } catch (error) {
    console.error("Send message error:", error);

    if (isKnownError(error)) {
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.status(500).json({
      success: false,
      error: "Unable to send message",
    });
  }
}

export async function sendToGuestController(
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

    const input = validateSendMessage(req.body);

    const message = await sendMessageToGuest(
      req.organization.id,
      req.user,
      req.params.guestId as string,
      "whatsapp",
      input.body
    );

    return res.status(201).json({ success: true, data: message });
  } catch (error) {
    console.error("Send message to guest error:", error);

    if (isKnownError(error)) {
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.status(500).json({
      success: false,
      error: "Unable to send message",
    });
  }
}

export async function linkConversationController(
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

    const input = validateLinkConversation(req.body);

    const updated = await linkConversation(
      req.organization.id,
      req.user,
      req.params.conversationId as string,
      input.guestId
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: "Conversation not found",
      });
    }

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("Link conversation error:", error);

    if (isKnownError(error)) {
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.status(500).json({
      success: false,
      error: "Unable to link conversation",
    });
  }
}

/* --------------------------------- Webhook --------------------------------- */

/**
 * GET /api/webhooks/whatsapp — Meta's subscription verification
 * handshake. Deliberately public (no auth) — Meta calls this
 * directly, unauthenticated, when you register the webhook URL in
 * the App Dashboard.
 */
export async function whatsappWebhookVerifyController(
  req: Request,
  res: Response
) {
  const adapter = getMessagingAdapter("whatsapp");

  const challenge = adapter.verifyWebhookSubscription(
    req.query["hub.mode"] as string | undefined,
    req.query["hub.verify_token"] as string | undefined,
    req.query["hub.challenge"] as string | undefined
  );

  if (challenge === null) {
    return res.status(403).send("Verification failed");
  }

  return res.status(200).send(challenge);
}

/**
 * POST /api/webhooks/whatsapp — the actual event delivery. Public
 * (Meta calls it directly), so the signature check IS the auth
 * boundary here — never trust the payload before it passes.
 *
 * See config/env.ts's whatsappOrganizationId doc comment: this phase
 * supports exactly one WhatsApp Business number for the whole
 * deployment, resolved to one organization via that env var — a
 * webhook event carries no PMS organization identity of its own.
 */
export async function whatsappWebhookReceiveController(
  req: Request,
  res: Response
) {
  try {
    const adapter = getMessagingAdapter("whatsapp");

    const signatureHeader = req.headers["x-hub-signature-256"] as
      | string
      | undefined;

    if (
      !adapter.isMock &&
      !adapter.verifyWebhookSignature(req.rawBody ?? Buffer.from(""), signatureHeader)
    ) {
      return res.status(401).json({ success: false, error: "Invalid signature" });
    }

    if (!env.whatsappOrganizationId) {
      console.error(
        "WhatsApp webhook received but WHATSAPP_ORGANIZATION_ID is not configured — dropping event."
      );
      // Still 200 — Meta retries on non-2xx, and retrying won't fix a
      // missing config value.
      return res.status(200).json({ success: true, data: { skipped: true } });
    }

    const parsed = adapter.parseWebhookPayload(req.body);

    const result = await ingestWebhook(
      env.whatsappOrganizationId,
      "whatsapp" as MessagingChannel,
      parsed
    );

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("WhatsApp webhook processing error:", error);
    // Still 200 to avoid Meta hammering retries on a processing bug —
    // the error is logged server-side for investigation.
    return res.status(200).json({ success: false });
  }
}
