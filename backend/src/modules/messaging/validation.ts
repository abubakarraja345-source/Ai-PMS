export interface SendMessageInput {
  body: string;
}

export function validateSendMessage(input: unknown): SendMessageInput {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid request body");
  }

  const data = input as Record<string, unknown>;

  if (typeof data.body !== "string" || !data.body.trim()) {
    throw new Error("body is required");
  }

  if (data.body.length > 4096) {
    throw new Error("body must be 4096 characters or fewer");
  }

  return { body: data.body.trim() };
}

export interface LinkConversationInput {
  guestId: string | null;
}

export function validateLinkConversation(input: unknown): LinkConversationInput {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid request body");
  }

  const data = input as Record<string, unknown>;

  if (data.guestId !== null && typeof data.guestId !== "string") {
    throw new Error("guestId must be a string or null");
  }

  return { guestId: data.guestId as string | null };
}
