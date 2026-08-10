import { supabase } from "../../config/supabase";
import { CleaningTask } from "./types";
import {
  CreateCleaningTaskInput,
  CleaningTaskFilters,
} from "./validation";

const CLEANING_SELECT = `
  id,
  organization_id,
  property_id,
  reservation_id,
  status,
  priority,
  scheduled_date,
  assigned_to,
  notes,
  started_at,
  completed_at,
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

export async function findCleaningTasksByOrganization(
  organizationId: string,
  filters: CleaningTaskFilters = {}
): Promise<CleaningTask[]> {
  let query = supabase
    .from("cleaning_tasks")
    .select(CLEANING_SELECT)
    .eq("organization_id", organizationId);

  if (filters.propertyId) {
    query = query.eq("property_id", filters.propertyId);
  }

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.priority) {
    query = query.eq("priority", filters.priority);
  }

  if (filters.scheduledDate) {
    query = query.eq(
      "scheduled_date",
      filters.scheduledDate
    );
  }

  if (filters.start) {
    query = query.gte("scheduled_date", filters.start);
  }

  if (filters.end) {
    query = query.lte("scheduled_date", filters.end);
  }

  query = query
    .order("scheduled_date", {
      ascending: true,
      nullsFirst: false,
    })
    .order("created_at", { ascending: false });

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as CleaningTask[];
}

export async function findCleaningTaskById(
  organizationId: string,
  taskId: string
): Promise<CleaningTask | null> {
  const { data, error } = await supabase
    .from("cleaning_tasks")
    .select(CLEANING_SELECT)
    .eq("id", taskId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as unknown as CleaningTask | null;
}

export async function createCleaningTask(
  organizationId: string,
  input: CreateCleaningTaskInput & {
    started_at?: string | null;
    completed_at?: string | null;
  }
): Promise<CleaningTask> {
  const { data, error } = await supabase
    .from("cleaning_tasks")
    .insert({
      organization_id: organizationId,

      property_id: input.property_id,
      reservation_id: input.reservation_id,

      status: input.status,
      priority: input.priority,

      scheduled_date: input.scheduled_date,
      assigned_to: input.assigned_to,
      notes: input.notes,

      started_at: input.started_at ?? null,
      completed_at: input.completed_at ?? null,
    })
    .select(CLEANING_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return data as unknown as CleaningTask;
}

export async function updateCleaningTask(
  organizationId: string,
  taskId: string,
  updates: Record<string, unknown>
): Promise<CleaningTask | null> {
  const { data, error } = await supabase
    .from("cleaning_tasks")
    .update(updates)
    .eq("id", taskId)
    .eq("organization_id", organizationId)
    .select(CLEANING_SELECT)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as unknown as CleaningTask | null;
}

export async function deleteCleaningTask(
  organizationId: string,
  taskId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("cleaning_tasks")
    .delete()
    .eq("id", taskId)
    .eq("organization_id", organizationId)
    .select("id");

  if (error) {
    throw error;
  }

  return !!data && data.length > 0;
}
