import { Request, Response } from "express";
import { OrganizationRequest } from "../../middleware/organization.middleware";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";

import {
  listInvitations,
  createInvitation,
  resendInvitation,
  revokeInvitation,
  acceptInvitation,
  previewInvitation,
} from "./invitations.service";

/**
 * Our own validation/business-rule checks throw plain `Error`s with
 * friendly, intentional messages — safe to forward. Supabase/Postgres
 * failures throw PostgrestError (which also extends Error) and must
 * not reach the client — same convention used across every other
 * module in this codebase.
 */
function isKnownError(error: unknown): error is Error {
  return error instanceof Error && error.name !== "PostgrestError";
}

function statusForCreateError(message: string): number {
  if (
    message.includes("already belongs to a member") ||
    message.includes("already pending")
  ) {
    return 409;
  }

  return 400;
}

function statusForAcceptError(message: string): number {
  if (
    message.includes("already belong to an organization") ||
    message === "This invitation has already been used"
  ) {
    return 409;
  }

  if (message === "This invitation has expired") {
    return 410;
  }

  return 400;
}

function requireInvitationId(req: OrganizationRequest): string | null {
  const id = req.params.id;
  return typeof id === "string" && id.trim() ? id : null;
}

export async function listInvitationsController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({
        success: false,
        error: "Organization context is required",
      });
    }

    const data = await listInvitations(req.organization.id);

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("List invitations error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to load invitations",
    });
  }
}

/**
 * GET /api/organization/invitations/:token — deliberately public (no
 * requireAuth). Lets the frontend show invitation details (org, role,
 * email, expiry) before the visitor authenticates. Never returns
 * token_hash — previewInvitation (service.ts) only ever returns a
 * hand-built safe object, never the raw repository row.
 */
export async function previewInvitationController(
  req: Request,
  res: Response
) {
  try {
    const token = req.params.token;

    if (!token || typeof token !== "string" || !token.trim()) {
      return res.status(400).json({
        success: false,
        error: "Invitation token is required",
      });
    }

    const data = await previewInvitation(token.trim());

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Preview invitation error:", error);

    if (isKnownError(error)) {
      return res.status(404).json({ success: false, error: error.message });
    }

    return res.status(500).json({
      success: false,
      error: "Unable to load invitation",
    });
  }
}

export async function createInvitationController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization || !req.user) {
      return res.status(403).json({
        success: false,
        error: "Organization context is required",
      });
    }

    const data = await createInvitation(
      req.organization.id,
      req.organization.name,
      req.user.id,
      req.body
    );

    return res.status(201).json({ success: true, data });
  } catch (error) {
    console.error("Create invitation error:", error);

    if (isKnownError(error)) {
      return res.status(statusForCreateError(error.message)).json({
        success: false,
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Unable to create invitation",
    });
  }
}

export async function resendInvitationController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({
        success: false,
        error: "Organization context is required",
      });
    }

    const invitationId = requireInvitationId(req);

    if (!invitationId) {
      return res.status(400).json({
        success: false,
        error: "Invitation ID is required",
      });
    }

    const data = await resendInvitation(
      req.organization.id,
      req.organization.name,
      invitationId
    );

    if (!data) {
      return res.status(404).json({
        success: false,
        error: "Invitation not found",
      });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Resend invitation error:", error);

    if (isKnownError(error)) {
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.status(500).json({
      success: false,
      error: "Unable to resend invitation",
    });
  }
}

export async function revokeInvitationController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({
        success: false,
        error: "Organization context is required",
      });
    }

    const invitationId = requireInvitationId(req);

    if (!invitationId) {
      return res.status(400).json({
        success: false,
        error: "Invitation ID is required",
      });
    }

    const data = await revokeInvitation(req.organization.id, invitationId);

    if (!data) {
      return res.status(404).json({
        success: false,
        error: "Invitation not found",
      });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Revoke invitation error:", error);

    if (isKnownError(error)) {
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.status(500).json({
      success: false,
      error: "Unable to revoke invitation",
    });
  }
}

/**
 * POST /api/organization/invitations/accept — deliberately gated by
 * requireAuth alone, not requireOrganization, since the whole point is
 * the caller may not have an organization yet. Same pattern as
 * POST /api/organization (onboarding's create-workspace endpoint).
 */
export async function acceptInvitationController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    const data = await acceptInvitation(
      req.user.id,
      req.user.email ?? "",
      req.body
    );

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Accept invitation error:", error);

    if (isKnownError(error)) {
      return res.status(statusForAcceptError(error.message)).json({
        success: false,
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Unable to accept invitation",
    });
  }
}
