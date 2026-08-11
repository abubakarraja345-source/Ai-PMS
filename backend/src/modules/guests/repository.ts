import { supabase } from "../../config/supabase";

export async function findGuestsByOrganization(
  organizationId: string,
  range: { from: number; to: number }
) {
  const { data, error, count } = await supabase
    .from("guests")
    .select(
      `
      id,
      organization_id,
      first_name,
      last_name,
      email,
      phone,
      country,
      language,
      passport_number,
      notes,
      vip,
      created_at,
      updated_at
    `,
      { count: "exact" }
    )
    .eq("organization_id", organizationId)
    .order("created_at", {
      ascending: false,
    })
    .range(range.from, range.to);

  if (error) {
    throw error;
  }

  return { data: data ?? [], total: count ?? 0 };
}

export async function findGuestById(
  organizationId: string,
  guestId: string
) {
  const { data, error } = await supabase
    .from("guests")
    .select("*")
    .eq("id", guestId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function createGuest(
  organizationId: string,
  input: {
    first_name: string;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
    country?: string | null;
    language?: string | null;
    passport_number?: string | null;
    notes?: string | null;
    vip?: boolean;
  }
) {
  const { data, error } = await supabase
    .from("guests")
    .insert({
      organization_id: organizationId,
      first_name: input.first_name,
      last_name: input.last_name ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      country: input.country ?? null,
      language: input.language ?? null,
      passport_number:
        input.passport_number ?? null,
      notes: input.notes ?? null,
      vip: input.vip ?? false,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateGuest(
  organizationId: string,
  guestId: string,
  updates: Record<string, unknown>
) {
  const { data, error } = await supabase
    .from("guests")
    .update(updates)
    .eq("id", guestId)
    .eq("organization_id", organizationId)
    .select("*")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteGuest(
  organizationId: string,
  guestId: string
) {
  const { data, error } = await supabase
    .from("guests")
    .delete()
    .eq("id", guestId)
    .eq("organization_id", organizationId)
    .select("id");

  if (error) {
    throw error;
  }

  return !!data && data.length > 0;
}