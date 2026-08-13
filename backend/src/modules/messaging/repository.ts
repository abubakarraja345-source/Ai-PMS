import { supabase } from "../../config/supabase";
import { MessagingChannel } from "./types";

export interface ConversationRow {
  id: string;
  organization_id: string;
  guest_id: string | null;
  reservation_id: string | null;
  channel: string;
  external_contact_id: string;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  guest?: { id: string; first_name: string; last_name: string | null } | null;
}

const CONVERSATION_SELECT =
  "id, organization_id, guest_id, reservation_id, channel, external_contact_id, last_message_at, created_at, updated_at, guest:guests(id, first_name, last_name)";

export async function findConversationsByOrganization(
  organizationId: string
): Promise<ConversationRow[]> {
  const { data, error } = await supabase
    .from("guest_conversations")
    .select(CONVERSATION_SELECT)
    .eq("organization_id", organizationId)
    .order("last_message_at", { ascending: false, nullsFirst: false });

  if (error) throw error;

  return (data ?? []) as unknown as ConversationRow[];
}

export async function findConversationById(
  organizationId: string,
  conversationId: string
): Promise<ConversationRow | null> {
  const { data, error } = await supabase
    .from("guest_conversations")
    .select(CONVERSATION_SELECT)
    .eq("id", conversationId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) throw error;

  return data as unknown as ConversationRow | null;
}

export async function findOrCreateConversation(
  organizationId: string,
  channel: MessagingChannel,
  externalContactId: string,
  guestId: string | null
): Promise<ConversationRow> {
  const { data: existing, error: findError } = await supabase
    .from("guest_conversations")
    .select(CONVERSATION_SELECT)
    .eq("organization_id", organizationId)
    .eq("channel", channel)
    .eq("external_contact_id", externalContactId)
    .maybeSingle();

  if (findError) throw findError;

  if (existing) {
    return existing as unknown as ConversationRow;
  }

  const { data: created, error: createError } = await supabase
    .from("guest_conversations")
    .insert({
      organization_id: organizationId,
      channel,
      external_contact_id: externalContactId,
      guest_id: guestId,
    })
    .select(CONVERSATION_SELECT)
    .single();

  if (createError) throw createError;

  return created as unknown as ConversationRow;
}

export async function linkConversationGuest(
  organizationId: string,
  conversationId: string,
  guestId: string | null
): Promise<ConversationRow | null> {
  const { data, error } = await supabase
    .from("guest_conversations")
    .update({ guest_id: guestId, updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("organization_id", organizationId)
    .select(CONVERSATION_SELECT)
    .maybeSingle();

  if (error) throw error;

  return data as unknown as ConversationRow | null;
}

export async function touchConversation(
  conversationId: string,
  lastMessageAt: string
): Promise<void> {
  const { error } = await supabase
    .from("guest_conversations")
    .update({ last_message_at: lastMessageAt, updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (error) throw error;
}

/* --------------------------------- Messages -------------------------------- */

export interface MessageRow {
  id: string;
  conversation_id: string;
  direction: "inbound" | "outbound";
  body: string;
  external_message_id: string | null;
  status: string;
  sent_by_user_id: string | null;
  created_at: string;
}

const MESSAGE_SELECT =
  "id, conversation_id, direction, body, external_message_id, status, sent_by_user_id, created_at";

export async function findMessagesByConversation(
  conversationId: string
): Promise<MessageRow[]> {
  const { data, error } = await supabase
    .from("guest_messages")
    .select(MESSAGE_SELECT)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return data ?? [];
}

export async function findMessageByExternalId(
  externalMessageId: string
): Promise<MessageRow | null> {
  const { data, error } = await supabase
    .from("guest_messages")
    .select(MESSAGE_SELECT)
    .eq("external_message_id", externalMessageId)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function insertMessage(input: {
  conversationId: string;
  direction: "inbound" | "outbound";
  body: string;
  externalMessageId: string | null;
  status: string;
  sentByUserId: string | null;
}): Promise<MessageRow> {
  const { data, error } = await supabase
    .from("guest_messages")
    .insert({
      conversation_id: input.conversationId,
      direction: input.direction,
      body: input.body,
      external_message_id: input.externalMessageId,
      status: input.status,
      sent_by_user_id: input.sentByUserId,
    })
    .select(MESSAGE_SELECT)
    .single();

  if (error) throw error;

  return data;
}

export async function updateMessageStatusByExternalId(
  externalMessageId: string,
  status: string
): Promise<void> {
  const { error } = await supabase
    .from("guest_messages")
    .update({ status })
    .eq("external_message_id", externalMessageId);

  if (error) throw error;
}

/* ------------------------------ Guest matching ------------------------------ */

/**
 * Best-effort phone match for auto-linking an inbound conversation to
 * a known guest — compares digits-only, then falls back to comparing
 * just the last 10 digits (national number) so a guest record saved
 * without a country code can still match an inbound E.164 number.
 * Never a hard requirement: manual linking in the UI is always the
 * fallback when this doesn't find a confident match.
 */
export async function findGuestByPhone(
  organizationId: string,
  phone: string
): Promise<{ id: string } | null> {
  const normalized = phone.replace(/\D/g, "");
  if (!normalized) return null;

  const { data, error } = await supabase
    .from("guests")
    .select("id, phone")
    .eq("organization_id", organizationId)
    .not("phone", "is", null);

  if (error) throw error;

  const national = normalized.slice(-10);

  for (const guest of data ?? []) {
    const guestDigits = (guest.phone ?? "").replace(/\D/g, "");
    if (!guestDigits) continue;

    if (guestDigits === normalized || guestDigits.slice(-10) === national) {
      return { id: guest.id };
    }
  }

  return null;
}
