export interface InvitationRow {
  id: string;
  organization_id: string;
  email: string;
  full_name: string | null;
  role: string;
  invited_by: string;
  status: string;
  token_hash: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Same shape as InvitationRow but without token_hash — this is the
 * only select projection allowed to reach anything that could return
 * to the client (list/create/resend/revoke responses). Only the
 * accept flow's internal token lookup ever selects token_hash, and it
 * never appears in that function's return value either. */
export type InvitationRowSafe = Omit<InvitationRow, "token_hash">;

export interface InvitationSummary {
  id: string;
  email: string;
  fullName: string | null;
  role: "company_admin" | "manager" | "host" | "member" | "spectator";
  status: "pending" | "accepted" | "revoked" | "expired";
  expiresAt: string;
  invitedBy: string;
  createdAt: string;
  acceptedAt: string | null;
}
