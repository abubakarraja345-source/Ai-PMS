const MAX_MESSAGE_LENGTH = 2000;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ValidatedChatInput {
  message: string;
  conversationId: string | null;
}

export function validateChatInput(input: unknown): ValidatedChatInput {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid request body");
  }

  const data = input as Record<string, unknown>;

  if (typeof data.message !== "string" || !data.message.trim()) {
    throw new Error("A message is required");
  }

  const message = data.message.trim();

  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new Error(
      `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer`
    );
  }

  let conversationId: string | null = null;

  if (
    data.conversationId !== undefined &&
    data.conversationId !== null &&
    data.conversationId !== ""
  ) {
    if (
      typeof data.conversationId !== "string" ||
      !UUID_RE.test(data.conversationId)
    ) {
      throw new Error("conversationId must be a valid id");
    }

    conversationId = data.conversationId;
  }

  return { message, conversationId };
}

export function validateConversationId(value: unknown): string {
  if (typeof value !== "string" || !UUID_RE.test(value)) {
    throw new Error("A valid conversation id is required");
  }

  return value;
}

const KNOWN_ACTION_TYPES = [
  "adjust_inventory",
  "mark_notification_read",
  "mark_all_notifications_read",
] as const;

export interface ValidatedExecuteActionInput {
  conversationId: string;
  actionType: string;
  params: Record<string, unknown>;
}

export function validateExecuteActionInput(
  input: unknown
): ValidatedExecuteActionInput {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid request body");
  }

  const data = input as Record<string, unknown>;

  const conversationId = validateConversationId(data.conversationId);

  if (
    typeof data.actionType !== "string" ||
    !KNOWN_ACTION_TYPES.includes(
      data.actionType as (typeof KNOWN_ACTION_TYPES)[number]
    )
  ) {
    throw new Error(
      `actionType must be one of: ${KNOWN_ACTION_TYPES.join(", ")}`
    );
  }

  if (data.params !== undefined && data.params !== null) {
    if (typeof data.params !== "object" || Array.isArray(data.params)) {
      throw new Error("params must be an object");
    }
  }

  return {
    conversationId,
    actionType: data.actionType,
    params: (data.params as Record<string, unknown>) ?? {},
  };
}
