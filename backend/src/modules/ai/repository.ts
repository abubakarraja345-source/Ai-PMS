import { supabase } from "../../config/supabase";
import { AiConversationRow, AiMessageRow } from "./types";

export async function createConversationRow(
  organizationId: string,
  createdBy: string,
  title: string | null
): Promise<AiConversationRow> {
  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({
      organization_id: organizationId,
      created_by: createdBy,
      title,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as AiConversationRow;
}

export async function findConversationById(
  organizationId: string,
  createdBy: string,
  conversationId: string
): Promise<AiConversationRow | null> {
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("organization_id", organizationId)
    .eq("created_by", createdBy)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as AiConversationRow) ?? null;
}

export async function findConversationsByUser(
  organizationId: string,
  createdBy: string
): Promise<AiConversationRow[]> {
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("created_by", createdBy)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as AiConversationRow[];
}

export async function deleteConversationRow(
  organizationId: string,
  createdBy: string,
  conversationId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("ai_conversations")
    .delete()
    .eq("id", conversationId)
    .eq("organization_id", organizationId)
    .eq("created_by", createdBy)
    .select("id");

  if (error) {
    throw error;
  }

  return (data ?? []).length > 0;
}

export async function deleteMessagesByConversation(
  conversationId: string
): Promise<void> {
  const { error } = await supabase
    .from("ai_messages")
    .delete()
    .eq("conversation_id", conversationId);

  if (error) {
    throw error;
  }
}

export async function createMessageRow(
  conversationId: string,
  role: string,
  message: string,
  model: string | null,
  tokens: number | null
): Promise<AiMessageRow> {
  const { data, error } = await supabase
    .from("ai_messages")
    .insert({
      conversation_id: conversationId,
      role,
      message,
      model,
      tokens,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as AiMessageRow;
}

export async function findMessagesByConversation(
  conversationId: string,
  limit = 50
): Promise<AiMessageRow[]> {
  const { data, error } = await supabase
    .from("ai_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as AiMessageRow[];
}
