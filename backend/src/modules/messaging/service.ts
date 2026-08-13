import { getMessagingAdapter } from "./registry";
import { isWhatsAppConfigured } from "./whatsapp/adapter";
import { isWhatsAppMockAllowed } from "./whatsapp/mockAdapter";
import { MessagingChannel } from "./types";

import {
  findConversationsByOrganization,
  findConversationById,
  findOrCreateConversation,
  linkConversationGuest,
  touchConversation,
  findMessagesByConversation,
  findMessageByExternalId,
  insertMessage,
  updateMessageStatusByExternalId,
  findGuestByPhone,
  ConversationRow,
  MessageRow,
} from "./repository";

import { findGuestById } from "../guests/repository";
import { logAudit } from "../auditLog/service";

export interface AuditActor {
  id: string;
  email?: string;
}

export function getChannelConfigStatus(channel: MessagingChannel): {
  configured: boolean;
  usingMockAdapter: boolean;
} {
  const adapter = getMessagingAdapter(channel);

  if (channel === "whatsapp") {
    return {
      configured: isWhatsAppMockAllowed() || isWhatsAppConfigured(),
      usingMockAdapter: adapter.isMock,
    };
  }

  return { configured: false, usingMockAdapter: false };
}

export async function listConversations(
  organizationId: string
): Promise<ConversationRow[]> {
  return findConversationsByOrganization(organizationId);
}

export async function listMessages(
  organizationId: string,
  conversationId: string
): Promise<MessageRow[]> {
  const conversation = await findConversationById(organizationId, conversationId);

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  return findMessagesByConversation(conversationId);
}

export async function linkConversation(
  organizationId: string,
  actor: AuditActor,
  conversationId: string,
  guestId: string | null
): Promise<ConversationRow | null> {
  if (guestId) {
    const guestExists = await findGuestById(organizationId, guestId);

    if (!guestExists) {
      throw new Error("Guest not found in your organization");
    }
  }

  const updated = await linkConversationGuest(
    organizationId,
    conversationId,
    guestId
  );

  if (updated) {
    void logAudit({
      organizationId,
      actorUserId: actor.id,
      actorLabel: actor.email ?? actor.id,
      action: "message.conversation_linked",
      entityType: "guest",
      entityId: guestId,
      metadata: { conversationId, unlinked: guestId === null },
    });
  }

  return updated;
}

/**
 * Sends a message to an existing conversation thread — the external
 * contact id (e.g. WhatsApp phone number) is already known from the
 * conversation record, so no guest lookup is needed here.
 */
export async function sendMessageToConversation(
  organizationId: string,
  actor: AuditActor,
  conversationId: string,
  body: string
): Promise<MessageRow> {
  const conversation = await findConversationById(organizationId, conversationId);

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  return sendAndStore(
    organizationId,
    actor,
    conversation.channel as MessagingChannel,
    conversation.id,
    conversation.external_contact_id,
    body
  );
}

/**
 * Starts (or continues) a conversation with a known guest by their
 * saved phone number — the entry point for "message this guest" from
 * a guest/reservation page rather than replying within an inbox
 * thread that already exists.
 */
export async function sendMessageToGuest(
  organizationId: string,
  actor: AuditActor,
  guestId: string,
  channel: MessagingChannel,
  body: string
): Promise<MessageRow> {
  const guest = await findGuestById(organizationId, guestId);

  if (!guest) {
    throw new Error("Guest not found in your organization");
  }

  if (!guest.phone) {
    throw new Error("This guest has no phone number on file");
  }

  const conversation = await findOrCreateConversation(
    organizationId,
    channel,
    guest.phone,
    guestId
  );

  return sendAndStore(
    organizationId,
    actor,
    channel,
    conversation.id,
    conversation.external_contact_id,
    body
  );
}

async function sendAndStore(
  organizationId: string,
  actor: AuditActor,
  channel: MessagingChannel,
  conversationId: string,
  externalContactId: string,
  body: string
): Promise<MessageRow> {
  const adapter = getMessagingAdapter(channel);
  const result = await adapter.sendText(externalContactId, body);

  const message = await insertMessage({
    conversationId,
    direction: "outbound",
    body,
    externalMessageId: result.externalMessageId,
    status: "sent",
    sentByUserId: actor.id,
  });

  await touchConversation(conversationId, message.created_at);

  return message;
}

/* ------------------------------- Webhook intake ------------------------------- */

export interface WebhookIngestResult {
  messagesReceived: number;
  statusUpdates: number;
}

/**
 * Processes an already-signature-verified webhook payload: dedupes
 * against external_message_id (webhook providers redeliver on
 * retry), best-effort auto-links the conversation to a known guest by
 * phone, stores each inbound message, and applies delivery-status
 * updates to previously-sent outbound messages. Never throws on a
 * single malformed event — skips it and keeps processing the rest,
 * matching the same "one bad item shouldn't fail the whole batch"
 * posture as the iCal sync engine.
 */
export async function ingestWebhook(
  organizationId: string,
  channel: MessagingChannel,
  parsed: { messages: { externalContactId: string; externalMessageId: string; body: string; contactDisplayName: string | null; timestamp: string }[]; statusUpdates: { externalMessageId: string; status: string }[] }
): Promise<WebhookIngestResult> {
  let messagesReceived = 0;

  for (const inbound of parsed.messages) {
    try {
      const alreadyStored = await findMessageByExternalId(
        inbound.externalMessageId
      );

      if (alreadyStored) continue;

      const matchedGuest = await findGuestByPhone(
        organizationId,
        inbound.externalContactId
      );

      const conversation = await findOrCreateConversation(
        organizationId,
        channel,
        inbound.externalContactId,
        matchedGuest?.id ?? null
      );

      await insertMessage({
        conversationId: conversation.id,
        direction: "inbound",
        body: inbound.body,
        externalMessageId: inbound.externalMessageId,
        status: "received",
        sentByUserId: null,
      });

      await touchConversation(conversation.id, inbound.timestamp);

      messagesReceived++;
    } catch (error) {
      console.error("Failed to ingest inbound message (skipped):", error);
    }
  }

  let statusUpdates = 0;

  for (const update of parsed.statusUpdates) {
    try {
      await updateMessageStatusByExternalId(
        update.externalMessageId,
        update.status
      );
      statusUpdates++;
    } catch (error) {
      console.error("Failed to apply status update (skipped):", error);
    }
  }

  return { messagesReceived, statusUpdates };
}
