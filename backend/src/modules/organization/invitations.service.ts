import crypto from "crypto";

import { env } from "../../config/env";
import { EmailService } from "../../services/email.service";

import {
  findInvitationsByOrganization,
  findInvitationById,
  findPendingInvitationByEmail,
  insertInvitation,
  findInvitationByTokenHash,
  updateInvitationToken,
  updateInvitationStatus,
  markInvitationAccepted,
  findOrganizationById,
} from "./invitations.repository";

import {
  findMembersByOrganization,
  findMembershipByUserId,
  insertMembership,
} from "./repository";
import { isUniqueViolation, resolveEmail } from "./service";

import {
  CreateInvitationInput,
  validateAcceptInvitation,
  validateCreateInvitation,
} from "./invitations.validation";
import { InvitationRowSafe } from "./invitations.types";
import { logAudit } from "../auditLog/service";

const DEFAULT_EXPIRY_DAYS = 7;

function invitationExpiryDays(): number {
  const raw = Number(process.env.INVITATION_EXPIRY_DAYS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_EXPIRY_DAYS;
}

/** crypto.randomBytes, never Math.random/user id/email — a predictable
 * token would let an attacker guess or brute-force their way into an
 * organization they weren't invited to. */
function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function expiresAtFromNow(): string {
  return new Date(
    Date.now() + invitationExpiryDays() * 24 * 60 * 60 * 1000
  ).toISOString();
}

function buildAcceptUrl(token: string): string {
  const base = env.frontendUrl || "http://localhost:3000";
  return `${base}/invitations/accept?token=${token}`;
}

function toSummary(row: InvitationRowSafe) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    status: row.status,
    expiresAt: row.expires_at,
    invitedBy: row.invited_by,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at,
  };
}

/**
 * Attaches non-production-only diagnostics to an invitation response:
 * whether the email actually sent, and (outside production only) the
 * raw accept URL so a developer without Resend configured can still
 * exercise the full flow. Never included in production responses —
 * this is the one deliberate place the raw token is allowed to leave
 * the backend process at all, and only into a response the calling
 * owner/company_admin themselves requested.
 */
function withDeliveryInfo<T extends Record<string, unknown>>(
  summary: T,
  emailResult: { sent: boolean; reason?: string },
  rawToken: string
) {
  return {
    ...summary,
    emailSent: emailResult.sent,
    emailStatus: emailResult.sent
      ? "sent"
      : emailResult.reason ?? "not sent",
    ...(env.nodeEnv !== "production"
      ? { dev: { acceptUrl: buildAcceptUrl(rawToken) } }
      : {}),
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
 * Public, unauthenticated preview by raw token — lets the frontend
 * show "you've been invited to X as Y" before the visitor logs in, so
 * they know what they're accepting before going through the magic-link
 * flow. Safe to leave unauthenticated: possessing the 256-bit random
 * token is already the credential (same principle as a password-reset
 * link), and this reveals nothing beyond what the invitation email
 * itself already told its recipient. Never returns token_hash — the
 * repository row is destructured field-by-field, never spread.
 */
export async function previewInvitation(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const invitation = await findInvitationByTokenHash(tokenHash);

  if (!invitation) {
    throw new Error("Invitation not found or invalid");
  }

  const organization = await findOrganizationById(invitation.organization_id);

  const isExpired = new Date(invitation.expires_at).getTime() <= Date.now();
  const effectiveStatus =
    invitation.status === "pending" && isExpired
      ? "expired"
      : invitation.status;

  return {
    organizationName: organization?.name ?? "Unknown organization",
    email: invitation.email,
    role: invitation.role,
    expiresAt: invitation.expires_at,
    status: effectiveStatus,
  };
}

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

  const existingPending = await findPendingInvitationByEmail(
    organizationId,
    input.email
  );

  if (existingPending) {
    throw new Error(
      "An invitation is already pending for this email — resend it instead of creating a new one"
    );
  }

  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = expiresAtFromNow();

  const invitation = await insertInvitation({
    organization_id: organizationId,
    email: input.email,
    full_name: input.fullName,
    role: input.role,
    invited_by: inviterId,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  const inviterEmail = await resolveEmail(inviterId);

  const emailResult = await EmailService.sendInvitation({
    to: input.email,
    organizationName,
    inviterEmail,
    role: input.role,
    acceptUrl: buildAcceptUrl(token),
  });

  void logAudit({
    organizationId,
    actorUserId: inviterId,
    actorLabel: inviterEmail ?? inviterId,
    action: "invitation.created",
    entityType: "invitation",
    entityId: invitation.id,
    metadata: { email: input.email, role: input.role },
  });

  return withDeliveryInfo(toSummary(invitation), emailResult, token);
}

export async function resendInvitation(
  organizationId: string,
  organizationName: string,
  invitationId: string,
  callerUserId?: string,
  callerEmail?: string
) {
  const invitation = await findInvitationById(organizationId, invitationId);

  if (!invitation) {
    return null;
  }

  if (invitation.status !== "pending") {
    throw new Error("Only pending invitations can be resent");
  }

  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = expiresAtFromNow();

  const updated = await updateInvitationToken(
    invitation.id,
    tokenHash,
    expiresAt
  );

  const inviterEmail = await resolveEmail(invitation.invited_by);

  const emailResult = await EmailService.sendInvitation({
    to: invitation.email,
    organizationName,
    inviterEmail,
    role: invitation.role,
    acceptUrl: buildAcceptUrl(token),
  });

  void logAudit({
    organizationId,
    actorUserId: callerUserId ?? null,
    actorLabel: callerEmail ?? callerUserId ?? null,
    action: "invitation.resent",
    entityType: "invitation",
    entityId: invitation.id,
    metadata: { email: invitation.email },
  });

  return withDeliveryInfo(
    toSummary(updated ?? invitation),
    emailResult,
    token
  );
}

export async function revokeInvitation(
  organizationId: string,
  invitationId: string,
  callerUserId?: string,
  callerEmail?: string
) {
  const invitation = await findInvitationById(organizationId, invitationId);

  if (!invitation) {
    return null;
  }

  if (invitation.status !== "pending") {
    throw new Error("Only pending invitations can be revoked");
  }

  const updated = await updateInvitationStatus(invitation.id, "revoked");

  if (updated) {
    void logAudit({
      organizationId,
      actorUserId: callerUserId ?? null,
      actorLabel: callerEmail ?? callerUserId ?? null,
      action: "invitation.revoked",
      entityType: "invitation",
      entityId: invitation.id,
      metadata: { email: invitation.email },
    });
  }

  return updated ? toSummary(updated) : null;
}

/**
 * Accepting an invitation. Concurrency-critical — see
 * markInvitationAccepted (invitations.repository.ts) for how a
 * double-accept of the SAME invitation is closed (atomic conditional
 * UPDATE), and organization_members_user_id_key (migration
 * 20260812000000) for how a user racing to accept TWO DIFFERENT
 * invitations at once is closed (database unique constraint). Both are
 * the actual source of truth; the checks below are the friendly
 * fast-path, not the security boundary.
 */
export async function acceptInvitation(
  userId: string,
  userEmail: string,
  rawInput: unknown
) {
  const { token } = validateAcceptInvitation(rawInput);
  const tokenHash = hashToken(token);

  const invitation = await findInvitationByTokenHash(tokenHash);

  if (!invitation) {
    throw new Error("Invitation not found or invalid");
  }

  if (invitation.status === "accepted") {
    throw new Error("This invitation has already been accepted");
  }

  if (invitation.status === "revoked") {
    throw new Error("This invitation is no longer valid");
  }

  const isExpired = new Date(invitation.expires_at).getTime() <= Date.now();

  if (invitation.status === "expired" || isExpired) {
    if (invitation.status === "pending") {
      await updateInvitationStatus(invitation.id, "expired").catch(
        () => {}
      );
    }

    throw new Error("This invitation has expired");
  }

  if (invitation.email !== userEmail.trim().toLowerCase()) {
    throw new Error("This invitation was sent to a different email address");
  }

  const existingMembership = await findMembershipByUserId(userId);

  if (existingMembership) {
    throw new Error(
      "You already belong to an organization and cannot accept this invitation."
    );
  }

  const organization = await findOrganizationById(invitation.organization_id);

  if (!organization) {
    throw new Error("The organization for this invitation no longer exists");
  }

  // Claim the invitation FIRST — this is the atomic step that actually
  // prevents a double-accept race (see markInvitationAccepted).
  const claimed = await markInvitationAccepted(invitation.id);

  if (!claimed) {
    throw new Error("This invitation has already been used");
  }

  try {
    await insertMembership(invitation.organization_id, userId, invitation.role);
  } catch (membershipError) {
    // The membership insert failed — most likely this same user won a
    // concurrent race by accepting a *different* invitation first (the
    // organization_members_user_id_key constraint rejected this one).
    // Un-claim the invitation so it isn't permanently burned for
    // nothing; the user gets a clean, correct error either way.
    await updateInvitationStatus(invitation.id, "pending").catch(() => {});

    if (isUniqueViolation(membershipError)) {
      throw new Error(
        "You already belong to an organization and cannot accept this invitation."
      );
    }

    throw membershipError;
  }

  return { id: organization.id, name: organization.name, role: invitation.role };
}
