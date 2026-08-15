import { supabase } from "../../config/supabase";
import { OrganizationMemberRow } from "./types";

/**
 * Existence check used by onboarding: does this user already belong
 * to any organization at all (not scoped to a specific org, since
 * the point is to find out which one, if any). Mirrors the same
 * `.limit(1).maybeSingle()` shape `requireOrganization` already uses.
 */
export async function findMembershipByUserId(
  userId: string
): Promise<OrganizationMemberRow | null> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("id, organization_id, user_id, role, created_at")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function findOrganizationBySlug(
  slug: string
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function insertOrganization(input: {
  name: string;
  slug: string;
  country: string | null;
  timezone: string | null;
  email?: string | null;
  phone?: string | null;
  numberOfListings?: number | null;
  propertyTypes?: string[];
  referralSource?: string | null;
}) {
  const insertData: Record<string, unknown> = {
    name: input.name,
    slug: input.slug,
  };

  if (input.country) insertData.country = input.country;
  if (input.timezone) insertData.timezone = input.timezone;
  if (input.email) insertData.email = input.email;
  if (input.phone) insertData.phone = input.phone;
  if (input.numberOfListings !== undefined && input.numberOfListings !== null) {
    insertData.number_of_listings = input.numberOfListings;
  }
  if (input.propertyTypes && input.propertyTypes.length > 0) {
    insertData.property_types = input.propertyTypes;
  }
  if (input.referralSource) insertData.referral_source = input.referralSource;

  const { data, error } = await supabase
    .from("organizations")
    .insert(insertData)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function insertMembership(
  organizationId: string,
  userId: string,
  role: string
): Promise<OrganizationMemberRow> {
  const { data, error } = await supabase
    .from("organization_members")
    .insert({
      organization_id: organizationId,
      user_id: userId,
      role,
    })
    .select("id, organization_id, user_id, role, created_at")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Compensating rollback for the no-true-transaction race-protection
 * strategy in service.ts's createOrganization — deletes an
 * organization created moments ago after a later step fails, so a
 * failed onboarding attempt never leaves an orphaned organization
 * with no members behind.
 */
export async function deleteOrganizationById(
  organizationId: string
): Promise<void> {
  const { error } = await supabase
    .from("organizations")
    .delete()
    .eq("id", organizationId);

  if (error) {
    throw error;
  }
}

export async function findMembersByOrganization(
  organizationId: string
): Promise<OrganizationMemberRow[]> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("id, organization_id, user_id, role, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function findMemberById(
  organizationId: string,
  memberId: string
): Promise<OrganizationMemberRow | null> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("id, organization_id, user_id, role, created_at")
    .eq("id", memberId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateMemberRole(
  organizationId: string,
  memberId: string,
  role: string
): Promise<OrganizationMemberRow | null> {
  const { data, error } = await supabase
    .from("organization_members")
    .update({ role })
    .eq("id", memberId)
    .eq("organization_id", organizationId)
    .select("id, organization_id, user_id, role, created_at")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteMember(
  organizationId: string,
  memberId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("organization_members")
    .delete()
    .eq("id", memberId)
    .eq("organization_id", organizationId)
    .select("id");

  if (error) {
    throw error;
  }

  return !!data && data.length > 0;
}
