import { Response } from "express";
import { OrganizationRequest } from "../../middleware/organization.middleware";

import { listInvitations, createInvitation } from "./invitations.service";

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
    message.includes("already belongs to another organization")
  ) {
    return 409;
  }

  return 400;
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
      error: "Unable to add this team member",
    });
  }
}
