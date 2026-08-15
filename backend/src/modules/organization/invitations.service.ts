import { env } from "../../config/env";
import { supabase } from "../../config/supabase";
import { EmailService } from "../../services/email.service";

import {
  findInvitationsByOrganization,
  insertInvitation,
} from "./invitations.repository";

import {
  findMembersByOrganization,
  insertMembership,
} from "./repository";
import {
  findAuthUserByEmail,
  generateTempPassword,
  isUniqueViolation,
  resolveEmail,
} from "./service";

import {
  CreateInvitationInput,
  validateCreateInvitation,
} from "./invitations.validation";
import { InvitationRowSafe } from "./invitations.types";
import { logAudit } from "../auditLog/service";

function loginUrl(): string {
  const base = env.frontendUrl || "http://localhost:3000";
  return `${base}/auth/login`;
}

function toSummary(row: InvitationRowSafe) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    status: row.status,
    accountProvisioned: row.account_provisioned,
    invitedBy: row.invited_by,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at,
  };
}

/**
 * organization_members has no email column — resolving "does this
 * email already belong to a member of this org" means resolving every
 * member's email via the Auth admin API, same pattern listMembers
 * (service.ts) already uses. Organizations are small enough in this
 * product that this N-lookup is consistent with existing precedent
 * rather than a new performance concern.
 */
async function isEmailAlreadyMember(
  organizationId: string,
  email: string
): Promise<boolean> {
  const members = await findMembersByOrganization(organizationId);

  const emails = await Promise.all(
    members.map((m) => resolveEmail(m.user_id))
  );

  return emails.some((e) => e?.toLowerCase() === email);
}

export async function listInvitations(organizationId: string) {
  const rows = await findInvitationsByOrganization(organizationId);
  return rows.map(toSummary);
}

/**
 * Adding a team member. There is no pending/accept step anymore — the
 * account and organization membership are both created synchronously
 * in this one call:
 *
 * - If no auth account exists for this email yet, one is created with
 *   a freshly generated temporary password (must_change_password
 *   metadata forces a change on first login — enforced client-side by
 *   app/auth/set-password, since Supabase has no native "force
 *   password reset" flag), and that password is emailed to them.
 * - If an account already exists for this email (e.g. they registered
 *   themselves previously but never created/joined an organization),
 *   it's reused as-is — no new password is generated or emailed, and
 *   they're simply notified they've been added. Because
 *   organization_members.user_id is globally unique (see
 *   organization_members_user_id_key), an existing account that
 *   *already* belongs to some organization can never reach this
 *   path successfully — insertMembership below will hit that
 *   constraint and this throws a friendly "already belongs to an
 *   organization" error, exactly like onboarding's own duplicate-org
 *   check.
 *
 * Any auth account created here is rolled back (deleted) if the
 * membership insert that follows it fails, so a failed invite never
 * leaves an orphaned, org-less account blocking a future retry.
 */
export async function createInvitation(
  organizationId: string,
  organizationName: string,
  inviterId: string,
  rawInput: unknown
) {
  const input: CreateInvitationInput = validateCreateInvitation(rawInput);

  const alreadyMember = await isEmailAlreadyMember(
    organizationId,
    input.email
  );

  if (alreadyMember) {
    throw new Error(
      "This email already belongs to a member of your organization"
    );
  }

  const existingUser = await findAuthUserByEmail(input.email);

  let userId: string;
  let tempPassword: string | null = null;
  const isNewAccount = !existingUser;

  if (existingUser) {
    userId = existingUser.id;
  } else {
    tempPassword = generateTempPassword();

    const { data: created, error: createUserError } =
      await supabase.auth.admin.createUser({
        email: input.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: input.fullName,
          must_change_password: true,
        },
      });

    if (createUserError || !created?.user) {
      throw new Error(
        createUserError?.message || "Unable to create this team member's account"
      );
    }

    userId = created.user.id;
  }

  try {
    await insertMembership(organizationId, userId, input.role);
  } catch (membershipError) {
    if (isNewAccount) {
      await supabase.auth.admin.deleteUser(userId).catch((cleanupError) => {
        console.error(
          "Failed to roll back auth account after a failed invite membership insert:",
          cleanupError
        );
      });
    }

    if (isUniqueViolation(membershipError)) {
      throw new Error(
        "This email already belongs to another organization and cannot be added here"
      );
    }

    throw membershipError;
  }

  const invitation = await insertInvitation({
    organization_id: organizationId,
    email: input.email,
    full_name: input.fullName,
    role: input.role,
    invited_by: inviterId,
    account_provisioned: isNewAccount,
  });

  const inviterEmail = await resolveEmail(inviterId);

  const emailResult = tempPassword
    ? await EmailService.sendTeamMemberCredentials({
        to: input.email,
        organizationName,
        inviterEmail,
        role: input.role,
        tempPassword,
        loginUrl: loginUrl(),
      })
    : await EmailService.sendAddedToOrganization({
        to: input.email,
        organizationName,
        inviterEmail,
        role: input.role,
        loginUrl: loginUrl(),
      });

  void logAudit({
    organizationId,
    actorUserId: inviterId,
    actorLabel: inviterEmail ?? inviterId,
    action: "invitation.created",
    entityType: "invitation",
    entityId: invitation.id,
    metadata: { email: input.email, role: input.role, accountProvisioned: isNewAccount },
  });

  return {
    ...toSummary(invitation),
    emailSent: emailResult.sent,
    emailStatus: emailResult.sent ? "sent" : emailResult.reason ?? "not sent",
  };
}
