export interface SettingsRow {
  id: string;
  organization_id: string | null;
  timezone: string;
  currency: string;
  language: string;
  check_in_time: string | null;
  check_out_time: string | null;
  guest_message_template: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationRow {
  id: string;
  name: string;
  updated_at: string;
}

export interface OrganizationSettings {
  name: string;
  timezone: string;
  currency: string;
  language: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  guestMessageTemplate: string | null;
  updatedAt: string | null;
}
