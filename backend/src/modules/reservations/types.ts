export interface PropertySummary {
  id: string;
  title: string;
}

export interface GuestSummary {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
}

export interface Reservation {
  id: string;

  organization_id: string;

  property_id: string;
  guest_id: string;

  property?: PropertySummary | null;
  guest?: GuestSummary | null;

  booking_reference: string | null;

  source: string;

  status: string | null;

  check_in: string;
  check_out: string;

  adults: number | null;
  children: number | null;
  infants: number | null;
  pets: number | null;

  nights: number | null;

  total_amount: number | null;
  cleaning_fee: number | null;
  taxes: number | null;

  currency: string | null;

  special_requests: string | null;

  /** Set only by sync logic (see integrations/sync.service.ts) when an
   * imported booking overlapped an existing confirmed reservation —
   * never settable through the public create/update reservation API.
   * Staff review and clear it manually. */
  needs_review: boolean;

  created_at: string;
  updated_at: string;
}

export interface ReservationListItem {
  id: string;

  property_id: string;
  guest_id: string;

  property?: PropertySummary | null;
  guest?: GuestSummary | null;

  booking_reference: string | null;

  source: string;

  status: string | null;

  check_in: string;
  check_out: string;

  adults: number | null;
  children: number | null;
  infants: number | null;
  pets: number | null;

  nights: number | null;

  total_amount: number | null;

  currency: string | null;

  needs_review: boolean;

  created_at: string;
  updated_at: string;
}