export interface InvitationRowSafe {
  id: string;
  organization_id: string;
  email: string;
  full_name: string | null;
  role: string;
  invited_by: string;
  status: string;
  account_provisioned: boolean;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvitationSummary {
  id: string;
  email: string;
  fullName: string | null;
  role: "company_admin" | "manager" | "host" | "member" | "spectator";
  status: "pending" | "accepted" | "revoked" | "expired";
  accountProvisioned: boolean;
  invitedBy: string;
  createdAt: string;
  acceptedAt: string | null;
}
