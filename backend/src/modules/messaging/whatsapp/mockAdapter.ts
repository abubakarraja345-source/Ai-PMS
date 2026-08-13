import { env } from "../../../config/env";
import {
  InboundMessage,
  MessagingAdapter,
  OutboundMessageResult,
  WebhookParseResult,
} from "../types";

/**
 * Dev-only — exercises send/receive/status pipeline without a real
 * Meta app. Same guard shape as integrations/airbnbApi/mockAdapter.ts:
 * requires NODE_ENV !== production AND an explicit opt-in env var, so
 * it's structurally impossible to select in production even if the
 * guard were somehow bypassed elsewhere.
 */
export function isWhatsAppMockAllowed(): boolean {
  return (
    env.nodeEnv !== "production" &&
    process.env.WHATSAPP_USE_MOCK_ADAPTER === "true"
  );
}

let mockMessageCounter = 0;

export const whatsappMockAdapter: MessagingAdapter = {
  channel: "whatsapp",
  isMock: true,

  async sendText(_to: string, _body: string): Promise<OutboundMessageResult> {
    mockMessageCounter += 1;
    return { externalMessageId: `mock-wamid-${mockMessageCounter}` };
  },

  verifyWebhookSubscription(mode, verifyToken, challenge): string | null {
    if (mode === "subscribe" && verifyToken === "mock-verify-token") {
      return challenge ?? null;
    }
    return null;
  },

  verifyWebhookSignature(): boolean {
    // The mock webhook test path never sends a real signature header —
    // this always passes so the pipeline (parse → dedup → store →
    // guest-link) can be exercised without a real app secret.
    return true;
  },

  parseWebhookPayload(body: unknown): WebhookParseResult {
    const data = body as {
      mockInboundMessage?: {
        from: string;
        id: string;
        body: string;
        name?: string;
      };
    };

    if (!data.mockInboundMessage) {
      return { messages: [], statusUpdates: [] };
    }

    const message: InboundMessage = {
      externalContactId: data.mockInboundMessage.from,
      externalMessageId: data.mockInboundMessage.id,
      body: data.mockInboundMessage.body,
      contactDisplayName: data.mockInboundMessage.name ?? "[MOCK] Guest",
      timestamp: new Date().toISOString(),
    };

    return { messages: [message], statusUpdates: [] };
  },
};
