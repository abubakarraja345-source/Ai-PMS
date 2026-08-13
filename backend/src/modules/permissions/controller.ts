import { Response } from "express";
import { OrganizationRequest } from "../../middleware/organization.middleware";
import {
  getMemberApprovalSetting,
  setMemberApprovalSetting,
  getRoleMatrixForOrganization,
} from "./service";
import { findAllAssignmentsForOrganization } from "./propertyAssignments.repository";
import { logAudit } from "../auditLog/service";
import { ROLE_LABELS } from "./roles";

/**
 * GET /api/organization/role-matrix — every role's effective
 * permissions for this org (Phase 7.5), backing the Team page's
 * "Change Role" gained/lost preview. View-level gate, same as the
 * roster — a member choosing between roles isn't a sensitive read.
 */
export async function getRoleMatrixController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const matrix = await getRoleMatrixForOrganization(req.organization.id);

    return res.status(200).json({
      success: true,
      data: { roleLabels: ROLE_LABELS, matrix },
    });
  } catch (error) {
    console.error("Get role matrix error:", error);
    return res.status(500).json({ success: false, error: "Unable to load role matrix" });
  }
}

/**
 * GET /api/organization/property-assignments — org-wide "who is
 * assigned to what," backing the Team page's per-member display
 * (Phase 7.5). Same view-level gate as the roster itself.
 */
export async function listOrganizationAssignmentsController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const rows = await findAllAssignmentsForOrganization(req.organization.id);

    return res.status(200).json({
      success: true,
      data: rows.map((r) => ({
        userId: r.user_id,
        propertyId: r.property_id,
        propertyTitle: r.property_title,
      })),
    });
  } catch (error) {
    console.error("List organization assignments error:", error);
    return res.status(500).json({ success: false, error: "Unable to load property assignments" });
  }
}

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
