import { Response } from "express";
import { OrganizationRequest } from "../../middleware/organization.middleware";

import {
  listMembers,
  changeMemberRole,
  removeMember,
} from "./service";

import { validateChangeRole } from "./validation";

/**
 * Our own validation/business-rule checks throw plain `Error`s
 * with friendly, intentional messages — safe to forward as
 * 400s. Supabase/Postgres failures throw PostgrestError (which
 * also extends Error) and must not reach the client — those
 * fall through to a generic sanitized 500 instead.
 */
function isKnownError(error: unknown): error is Error {
  return (
    error instanceof Error && error.name !== "PostgrestError"
  );
}

export async function listMembersController(
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

    const data = await listMembers(req.organization.id);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("List members error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to load organization members",
    });
  }
}

export async function changeMemberRoleController(
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

    const { role } = validateChangeRole(req.body);

    const updated = await changeMemberRole(
      req.organization.id,
      req.user.id,
      req.params.id,
      role
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: "Member not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Change member role error:", error);

    if (isKnownError(error)) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Unable to change member role",
    });
  }
}

export async function removeMemberController(
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

    const removed = await removeMember(
      req.organization.id,
      req.user.id,
      req.params.id
    );

    if (!removed) {
      return res.status(404).json({
        success: false,
        error: "Member not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Member removed successfully",
    });
  } catch (error) {
    console.error("Remove member error:", error);

    if (isKnownError(error)) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Unable to remove member",
    });
  }
}
