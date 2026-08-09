export interface Reservation {
  id: string;
  organization_id: string;
  property_id: string;
  guest_id: string;

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

  created_at: string;
  updated_at: string;
}

export interface ReservationListItem {
  id: string;
  property_id: string;
  guest_id: string;
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
  created_at: string;
  updated_at: string;
}