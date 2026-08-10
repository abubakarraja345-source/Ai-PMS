import { supabase } from "../../config/supabase";
import { MaintenanceTicket } from "./types";
import {
  CreateMaintenanceTicketInput,
  MaintenanceTicketFilters,
} from "./validation";

const MAINTENANCE_SELECT = `
  id,
  organization_id,
  property_id,
  reservation_id,
  reported_by,
  assigned_to,
  category,
  priority,
  status,
  title,
  description,
  estimated_cost,
  actual_cost,
  opened_at,
  resolved_at,
  created_at,
  updated_at,

  property:properties(
    id,
    title
  ),

  reservation:reservations(
    id,
    check_in,
    check_out,
    booking_reference,
    guest:guests(
      id,
      first_name,
      last_name
    )
  )
`;

export async function findMaintenanceTicketsByOrganization(
  organizationId: string,
  filters: MaintenanceTicketFilters = {}
): Promise<MaintenanceTicket[]> {
  let query = supabase
    .from("maintenance_tickets")
    .select(MAINTENANCE_SELECT)
    .eq("organization_id", organizationId);

  if (filters.propertyId) {
    query = query.eq("property_id", filters.propertyId);
  }

  if (filters.reservationId) {
    query = query.eq(
      "reservation_id",
      filters.reservationId
    );
  }

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.priority) {
    query = query.eq("priority", filters.priority);
  }

  if (filters.category) {
    query = query.eq("category", filters.category);
  }

  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as MaintenanceTicket[];
}

export async function findMaintenanceTicketById(
  organizationId: string,
  ticketId: string
): Promise<MaintenanceTicket | null> {
  const { data, error } = await supabase
    .from("maintenance_tickets")
    .select(MAINTENANCE_SELECT)
    .eq("id", ticketId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as unknown as MaintenanceTicket | null;
}

export async function createMaintenanceTicket(
  organizationId: string,
  reportedBy: string,
  input: CreateMaintenanceTicketInput & {
    resolved_at?: string | null;
  }
): Promise<MaintenanceTicket> {
  const { data, error } = await supabase
    .from("maintenance_tickets")
    .insert({
      organization_id: organizationId,
      reported_by: reportedBy,

      property_id: input.property_id,
      reservation_id: input.reservation_id,
      assigned_to: input.assigned_to,

      category: input.category,
      priority: input.priority,
      status: input.status,

      title: input.title,
      description: input.description,

      estimated_cost: input.estimated_cost,
      actual_cost: input.actual_cost,

      resolved_at: input.resolved_at ?? null,

      // opened_at intentionally omitted — the database default
      // (now()) applies; clients can never control it.
    })
    .select(MAINTENANCE_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return data as unknown as MaintenanceTicket;
}

export async function updateMaintenanceTicket(
  organizationId: string,
  ticketId: string,
  updates: Record<string, unknown>
): Promise<MaintenanceTicket | null> {
  const { data, error } = await supabase
    .from("maintenance_tickets")
    .update(updates)
    .eq("id", ticketId)
    .eq("organization_id", organizationId)
    .select(MAINTENANCE_SELECT)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as unknown as MaintenanceTicket | null;
}

export async function deleteMaintenanceTicket(
  organizationId: string,
  ticketId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("maintenance_tickets")
    .delete()
    .eq("id", ticketId)
    .eq("organization_id", organizationId)
    .select("id");

  if (error) {
    throw error;
  }

  return !!data && data.length > 0;
}
