export interface CleaningPropertySummary {
  id: string;
  title: string;
}

export interface CleaningReservationGuestSummary {
  id: string;
  first_name: string;
  last_name: string | null;
}

export interface CleaningReservationSummary {
  id: string;
  check_in: string;
  check_out: string;
  booking_reference: string | null;
  guest?: CleaningReservationGuestSummary | null;
}

export interface CleaningTask {
  id: string;
  organization_id: string;
  property_id: string;
  reservation_id: string | null;
  status: string;
  priority: string;
  scheduled_date: string | null;
  assigned_to: string | null;
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;

  property?: CleaningPropertySummary | null;
  reservation?: CleaningReservationSummary | null;
}
