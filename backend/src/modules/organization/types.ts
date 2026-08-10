import { OrganizationRole } from "../../middleware/organization.middleware";

export interface OrganizationMemberRow {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  created_at: string;
}

export interface OrganizationMember {
  id: string;
  userId: string;
  email: string | null;
  role: OrganizationRole;
  createdAt: string;
}
