import { supabase } from "../../config/supabase";
import { InvitationRow, InvitationRowSafe } from "./invitations.types";

/**
 * token_hash is deliberately excluded from this projection — every
 * function below that can return data to a controller (and therefore
 * eventually the client) uses this select list. Only
 * findInvitationByTokenHash (the accept flow's internal lookup) selects
 * the full row including token_hash, and it is never included in that
 * function's return value being forwarded to a response.
 */
const INVITATION_SELECT_SAFE =
  "id, organization_id, email, full_name, role, invited_by, status, expires_at, accepted_at, created_at, updated_at";

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

export async function findInvitationById(
  organizationId: string,
  invitationId: string
): Promise<InvitationRowSafe | null> {
  const { data, error } = await supabase
    .from("organization_invitations")
    .select(INVITATION_SELECT_SAFE)
    .eq("id", invitationId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function findPendingInvitationByEmail(
  organizationId: string,
  email: string
): Promise<InvitationRowSafe | null> {
  const { data, error } = await supabase
    .from("organization_invitations")
    .select(INVITATION_SELECT_SAFE)
    .eq("organization_id", organizationId)
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function insertInvitation(input: {
  organization_id: string;
  email: string;
  full_name: string | null;
  role: string;
  invited_by: string;
  token_hash: string;
  expires_at: string;
}): Promise<InvitationRowSafe> {
  const { data, error } = await supabase
    .from("organization_invitations")
    .insert(input)
    .select(INVITATION_SELECT_SAFE)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * The only function in this file that selects token_hash — used
 * exclusively by the accept flow to compare a hashed incoming token
 * against stored invitations. Callers must never forward the returned
 * row's token_hash field in any response.
 */
export async function findInvitationByTokenHash(
  tokenHash: string
): Promise<InvitationRow | null> {
  const { data, error } = await supabase
    .from("organization_invitations")
    .select(
      "id, organization_id, email, full_name, role, invited_by, status, token_hash, expires_at, accepted_at, created_at, updated_at"
    )
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateInvitationToken(
  invitationId: string,
  tokenHash: string,
  expiresAt: string
): Promise<InvitationRowSafe | null> {
  const { data, error } = await supabase
    .from("organization_invitations")
    .update({
      token_hash: tokenHash,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invitationId)
    .select(INVITATION_SELECT_SAFE)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateInvitationStatus(
  invitationId: string,
  status: string
): Promise<InvitationRowSafe | null> {
  const { data, error } = await supabase
    .from("organization_invitations")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", invitationId)
    .select(INVITATION_SELECT_SAFE)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Atomically claims a pending invitation for acceptance: the WHERE
 * status='pending' guard makes this a single conditional UPDATE
 * statement, so two concurrent accept attempts on the SAME invitation
 * can never both succeed — the loser's UPDATE simply matches zero rows
 * (status is no longer 'pending' by the time it runs) and this returns
 * null. This is what actually makes "never accept an invitation twice"
 * safe under concurrency, not an application-level check-then-act.
 */
export async function markInvitationAccepted(
  invitationId: string
): Promise<InvitationRowSafe | null> {
  const { data, error } = await supabase
    .from("organization_invitations")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", invitationId)
    .eq("status", "pending")
    .select(INVITATION_SELECT_SAFE)
    .maybeSingle();

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
