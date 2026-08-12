export interface SettingsRow {
  id: string;
  organization_id: string | null;
  timezone: string;
  currency: string;
  language: string;
  check_in_time: string | null;
  check_out_time: string | null;
  guest_message_template: string | null;
  /** Currency all reservation amounts get converted INTO for
   * consolidated multi-currency reporting. NULL means "inherit
   * `currency`" — mirrors properties.currency's inheritance pattern. */
  base_currency: string | null;
  /** Purely a report-rendering preference — NULL means "same as
   * base_currency". Never affects what's stored, only what a report
   * converts a base-currency total into on the fly at request time. */
  display_currency: string | null;
  /** 'auto' fetches/caches live rates; 'manual' only ever uses rates
   * an owner/company_admin explicitly entered. */
  exchange_rate_mode: "auto" | "manual";
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
  baseCurrency: string;
  displayCurrency: string;
  exchangeRateMode: "auto" | "manual";
  updatedAt: string | null;
}
