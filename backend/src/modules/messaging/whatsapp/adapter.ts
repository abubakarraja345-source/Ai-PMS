import crypto from "crypto";
import { env } from "../../../config/env";
import {
  InboundMessage,
  MessagingAdapter,
  MessagingNotConfiguredError,
  OutboundMessageResult,
  StatusUpdate,
  WebhookParseResult,
} from "../types";

/**
 * Real adapter for Meta's WhatsApp Business Cloud API — built against
 * the stable, public, documented Graph API messaging contract (send
 * endpoint, webhook payload shape, X-Hub-Signature-256 HMAC scheme),
 * unlike Airbnb's gated partner API this is safe to implement for
 * real rather than stub out. Still fails closed with
 * MessagingNotConfiguredError when credentials are missing — no
 * project credentials exist yet, so that's the expected state until
 * an operator completes Meta's WhatsApp Business setup.
 *
 * If Meta's API contract has shifted since this was written, the
 * failure mode is a clear HTTP error from Meta's own API (surfaced as
 * a thrown Error with Meta's own error message), never a silently
 * wrong "success".
 */

export function isWhatsAppConfigured(): boolean {
  return Boolean(env.whatsappAccessToken && env.whatsappPhoneNumberId);
}

function assertConfigured(): void {
  if (!isWhatsAppConfigured()) {
    throw new MessagingNotConfiguredError(
      "WhatsApp is not configured. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID."
    );
  }
}

function graphUrl(path: string): string {
  return `https://graph.facebook.com/${env.whatsappApiVersion}${path}`;
}

export const whatsappAdapter: MessagingAdapter = {
  channel: "whatsapp",
  isMock: false,

  async sendText(to: string, body: string): Promise<OutboundMessageResult> {
    assertConfigured();

    const response = await fetch(
      graphUrl(`/${env.whatsappPhoneNumberId}/messages`),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.whatsappAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "text",
          text: { preview_url: false, body },
        }),
      }
    );

    const result = (await response.json().catch(() => null)) as {
      messages?: { id: string }[];
      error?: { message?: string };
    } | null;

    if (!response.ok || !result?.messages?.[0]?.id) {
      throw new Error(
        result?.error?.message ||
          `WhatsApp send failed with status ${response.status}`
      );
    }

    return { externalMessageId: result.messages[0].id };
  },

  verifyWebhookSubscription(mode, verifyToken, challenge): string | null {
    if (!env.whatsappWebhookVerifyToken) return null;

    if (mode === "subscribe" && verifyToken === env.whatsappWebhookVerifyToken) {
      return challenge ?? null;
    }

    return null;
  },

  /**
   * Meta signs the RAW request body (before JSON parsing) with
   * HMAC-SHA256 using the app secret — see app.ts's express.json()
   * `verify` callback, which is what makes rawBody available here at
   * all despite the body already being parsed by the time Express
   * routing reaches this module.
   */
  verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
    if (!env.whatsappAppSecret) return false;
    if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;

    const expected = crypto
      .createHmac("sha256", env.whatsappAppSecret)
      .update(rawBody)
      .digest("hex");

    const provided = signatureHeader.slice("sha256=".length);

    if (provided.length !== expected.length) return false;

    return crypto.timingSafeEqual(
      Buffer.from(provided, "hex"),
      Buffer.from(expected, "hex")
    );
  },

  parseWebhookPayload(body: unknown): WebhookParseResult {
    const messages: InboundMessage[] = [];
    const statusUpdates: StatusUpdate[] = [];

    const entries = (body as { entry?: unknown[] })?.entry;
    if (!Array.isArray(entries)) return { messages, statusUpdates };

    for (const entry of entries) {
      const changes = (entry as { changes?: unknown[] })?.changes;
      if (!Array.isArray(changes)) continue;

      for (const change of changes) {
        const value = (change as { value?: Record<string, unknown> })?.value;
        if (!value) continue;

        const contacts = (value.contacts as
          | { wa_id?: string; profile?: { name?: string } }[]
          | undefined) ?? [];
        const nameByWaId = new Map(
          contacts.map((c) => [c.wa_id, c.profile?.name ?? null])
        );

        const rawMessages = (value.messages as
          | {
              from?: string;
              id?: string;
              timestamp?: string;
              type?: string;
              text?: { body?: string };
            }[]
          | undefined) ?? [];

        for (const m of rawMessages) {
          if (!m.from || !m.id || m.type !== "text" || !m.text?.body) continue;

          messages.push({
            externalContactId: m.from,
            externalMessageId: m.id,
            body: m.text.body,
            contactDisplayName: nameByWaId.get(m.from) ?? null,
            timestamp: m.timestamp
              ? new Date(Number(m.timestamp) * 1000).toISOString()
              : new Date().toISOString(),
          });
        }

        const rawStatuses = (value.statuses as
          | { id?: string; status?: string }[]
          | undefined) ?? [];

        for (const s of rawStatuses) {
          if (
            !s.id ||
            !s.status ||
            !["sent", "delivered", "read", "failed"].includes(s.status)
          ) {
            continue;
          }

          statusUpdates.push({
            externalMessageId: s.id,
            status: s.status as StatusUpdate["status"],
          });
        }
      }
    }

    return { messages, statusUpdates };
  },
};
