export interface NotificationRow {
  id: string;
  organization_id: string;
  user_id: string;
  title: string;
  message: string | null;
  notification_type: string;
  is_read: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string | null;
  notificationType: string;
  isRead: boolean;
  createdAt: string;
}

export interface NewNotificationRow {
  organization_id: string;
  user_id: string;
  title: string;
  message: string | null;
  notification_type: string;
}
