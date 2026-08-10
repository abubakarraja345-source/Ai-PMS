import { supabase } from "../../config/supabase";
import { NewNotificationRow, NotificationRow } from "./types";

export async function insertNotifications(
  rows: NewNotificationRow[]
): Promise<void> {
  if (rows.length === 0) return;

  const { error } = await supabase
    .from("notifications")
    .insert(rows);

  if (error) {
    throw error;
  }
}

export async function findNotificationsForUser(
  organizationId: string,
  userId: string
): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function countUnreadForUser(
  organizationId: string,
  userId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function markNotificationRead(
  organizationId: string,
  userId: string,
  notificationId: string
): Promise<NotificationRow | null> {
  const { data, error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function markAllNotificationsRead(
  organizationId: string,
  userId: string
): Promise<number> {
  const { data, error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("is_read", false)
    .select("id");

  if (error) {
    throw error;
  }

  return data?.length ?? 0;
}

export async function deleteNotification(
  organizationId: string,
  userId: string,
  notificationId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId)
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .select("id");

  if (error) {
    throw error;
  }

  return !!data && data.length > 0;
}
