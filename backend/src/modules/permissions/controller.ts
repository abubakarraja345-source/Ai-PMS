import { Response } from "express";
import { OrganizationRequest } from "../../middleware/organization.middleware";
import {
  getMemberApprovalSetting,
  setMemberApprovalSetting,
} from "./service";
import { logAudit } from "../auditLog/service";

/**
 * GET/POST /api/organization/approval-settings — the one bundled
 * toggle this checkpoint ships, not a full generic permission-matrix
 * editor (that's a larger, separate UI surface deliberately out of
 * scope here). Bundles the 3 reservation resource_actions the matrix
 * defaults to "approval" for role=member into a single on/off switch,
 * since that's the one thing the spec's worked example actually asks
 * an owner to be able to configure.
 */
export async function getApprovalSettingController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const requireApproval = await getMemberApprovalSetting(req.organization.id);

    return res.status(200).json({ success: true, data: { requireApprovalForMembers: requireApproval } });
  } catch (error) {
    console.error("Get approval setting error:", error);
    return res.status(500).json({ success: false, error: "Unable to load approval settings" });
  }
}

export async function updateApprovalSettingController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization || !req.user) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const requireApproval = req.body?.requireApprovalForMembers;

    if (typeof requireApproval !== "boolean") {
      return res.status(400).json({
        success: false,
        error: "requireApprovalForMembers must be true or false",
      });
    }

    await setMemberApprovalSetting(req.organization.id, requireApproval);

    void logAudit({
      organizationId: req.organization.id,
      actorUserId: req.user.id,
      actorLabel: req.user.email ?? req.user.id,
      action: "permission_override.changed",
      entityType: "organization",
      entityId: req.organization.id,
      metadata: {
        setting: "requireApprovalForMembers",
        value: requireApproval,
      },
    });

    return res.status(200).json({
      success: true,
      data: { requireApprovalForMembers: requireApproval },
    });
  } catch (error) {
    console.error("Update approval setting error:", error);
    return res.status(500).json({ success: false, error: "Unable to update approval settings" });
  }
}
