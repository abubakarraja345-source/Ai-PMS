export interface MaintenancePropertySummary {
  id: string;
  title: string;
}

export interface MaintenanceReservationGuestSummary {
  id: string;
  first_name: string;
  last_name: string | null;
}

export interface MaintenanceReservationSummary {
  id: string;
  check_in: string;
  check_out: string;
  booking_reference: string | null;
  guest?: MaintenanceReservationGuestSummary | null;
}

export interface MaintenanceTicket {
  id: string;
  organization_id: string;
  property_id: string;
  reservation_id: string | null;
  reported_by: string | null;
  assigned_to: string | null;
  category: string | null;
  priority: string;
  status: string;
  title: string;
  description: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  opened_at: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;

  property?: MaintenancePropertySummary | null;
  reservation?: MaintenanceReservationSummary | null;
}
