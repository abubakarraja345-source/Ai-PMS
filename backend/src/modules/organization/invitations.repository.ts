import { supabase } from "../../config/supabase";
import { InvitationRowSafe } from "./invitations.types";

/**
 * token_hash/expires_at are vestigial now that team members are
 * provisioned immediately (see invitations.service.ts) rather than
 * via an email/accept-link token — both columns were relaxed to
 * nullable rather than dropped (see migration
 * 20260818000000_organization_onboarding_fields_and_password_auth.sql)
 * so historical rows stay intact. This projection excludes token_hash
 * regardless, since nothing should ever need to read it again.
 */
const INVITATION_SELECT_SAFE =
  "id, organization_id, email, full_name, role, invited_by, status, account_provisioned, accepted_at, created_at, updated_at";

export async function findInvitationsByOrganization(
  organizationId: string
): Promise<InvitationRowSafe[]> {
  const { data, error } = await supabase
    .from("organization_invitations")
    .select(INVITATION_SELECT_SAFE)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

/**
 * organization_invitations is now written purely as a historical
 * record of "who was added, when, with what role" (see
 * invitations.service.ts's createInvitation) — every row is inserted
 * with status 'accepted' immediately, since there's no pending/accept
 * step left in this flow.
 */
export async function insertInvitation(input: {
  organization_id: string;
  email: string;
  full_name: string | null;
  role: string;
  invited_by: string;
  account_provisioned: boolean;
}): Promise<InvitationRowSafe> {
  const { data, error } = await supabase
    .from("organization_invitations")
    .insert({
      ...input,
      status: "accepted",
      accepted_at: new Date().toISOString(),
    })
    .select(INVITATION_SELECT_SAFE)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function findOrganizationById(
  organizationId: string
): Promise<{ id: string; name: string } | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", organizationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}
