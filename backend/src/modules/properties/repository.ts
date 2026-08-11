import { supabase } from "../../config/supabase";
import {
  Property,
  PropertyListItem,
} from "./types";
import { CreatePropertyInput } from "./validation";

export async function findPropertiesByOrganization(
  organizationId: string,
  range: { from: number; to: number }
): Promise<{ data: PropertyListItem[]; total: number }> {
  const { data, error, count } = await supabase
    .from("properties")
    .select(
      `
      id,
      title,
      property_type,
      description,
      address,
      city,
      state,
      country,
      bedrooms,
      bathrooms,
      beds,
      max_guests,
      status,
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

export async function createProperty(
  organizationId: string,
  userId: string,
  input: CreatePropertyInput
): Promise<Property> {
  const { data, error } = await supabase
    .from("properties")
    .insert({
      organization_id: organizationId,
      created_by: userId,

      title: input.title,
      property_type: input.property_type,
      description: input.description,
      address: input.address,
      city: input.city,
      state: input.state,
      country: input.country,
      postal_code: input.postal_code,

      latitude: input.latitude,
      longitude: input.longitude,

      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms,
      beds: input.beds,
      max_guests: input.max_guests,

      check_in_time: input.check_in_time,
      check_out_time: input.check_out_time,

      house_manual_url: input.house_manual_url,
      status: input.status ?? "active",
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateProperty(
  organizationId: string,
  propertyId: string,
  updates: Record<string, unknown>
): Promise<Property | null> {
  const { data, error } = await supabase
    .from("properties")
    .update(updates)
    .eq("id", propertyId)
    .eq("organization_id", organizationId)
    .select("*")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}
export async function findPropertyById(
  organizationId: string,
  propertyId: string
): Promise<Property | null> {
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}
export async function deleteProperty(
  organizationId: string,
  propertyId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("properties")
    .delete()
    .eq("id", propertyId)
    .eq("organization_id", organizationId)
    .select("id");

  if (error) {
    throw error;
  }

  return !!data && data.length > 0;
}