/**
 * Guest Messaging — channel-adapter architecture mirroring
 * integrations/airbnbApi's pattern: one normalized interface, real
 * adapters per channel, a dev-only mock for testing the pipeline
 * without live credentials. "whatsapp" is the only channel today;
 * instagram/airbnb/booking.com/vrbo messaging are future additions
 * that plug into this same shape without touching the pipeline
 * around them.
 */
export const MESSAGING_CHANNELS = ["whatsapp"] as const;
export type MessagingChannel = (typeof MESSAGING_CHANNELS)[number];

export interface OutboundMessageResult {
  externalMessageId: string;
}

export interface InboundMessage {
  externalContactId: string; // e.g. the guest's WhatsApp phone number
  externalMessageId: string;
  body: string;
  contactDisplayName: string | null;
  timestamp: string; // ISO
}

export interface StatusUpdate {
  externalMessageId: string;
  status: "sent" | "delivered" | "read" | "failed";
}

export interface WebhookParseResult {
  messages: InboundMessage[];
  statusUpdates: StatusUpdate[];
}

export class MessagingNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MessagingNotConfiguredError";
  }
}

export interface MessagingAdapter {
  readonly channel: MessagingChannel;
  readonly isMock: boolean;

  sendText(to: string, body: string): Promise<OutboundMessageResult>;

  /** Verifies a webhook subscription challenge (GET) — returns the
   * challenge string to echo back if the verify token matches, or
   * null if it doesn't. */
  verifyWebhookSubscription(
    mode: string | undefined,
    verifyToken: string | undefined,
    challenge: string | undefined
  ): string | null;

  /** Verifies the webhook delivery's signature against the raw
   * request body — must run BEFORE parsing/trusting the payload. */
  verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean;

  parseWebhookPayload(body: unknown): WebhookParseResult;
}
