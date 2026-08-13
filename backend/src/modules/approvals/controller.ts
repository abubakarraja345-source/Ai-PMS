import { Response } from "express";
import { OrganizationRequest } from "../../middleware/organization.middleware";
import { listApprovals, approveRequest, rejectRequest } from "./service";
import { getEffect } from "../permissions/service";
import { ApprovalStatus } from "./types";

function isKnownError(error: unknown): error is Error {
  return error instanceof Error && error.name !== "PostgrestError";
}

const VALID_STATUSES: ApprovalStatus[] = ["pending", "approved", "rejected", "cancelled"];

export async function listApprovalsController(req: OrganizationRequest, res: Response) {
  try {
    if (!req.organization || !req.user) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const statusParam = req.query.status;
    const status =
      typeof statusParam === "string" && VALID_STATUSES.includes(statusParam as ApprovalStatus)
        ? (statusParam as ApprovalStatus)
        : undefined;

    const page = Number(req.query.page) || 1;

    const canReview =
      (await getEffect(req.organization.id, req.organization.role, "approvals.review")) === "allow";

    const data = await listApprovals(
      req.organization.id,
      canReview,
      req.user.id,
      status ? { status } : {},
      page
    );

    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    console.error("List approvals error:", error);
    return res.status(500).json({ success: false, error: "Unable to load approval requests" });
  }
}

export async function approveRequestController(req: OrganizationRequest, res: Response) {
  try {
    if (!req.organization || !req.user) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ success: false, error: "Approval request ID is required" });
    }

    const reviewNote =
      typeof req.body?.reviewNote === "string" ? req.body.reviewNote.trim() || null : null;

    const data = await approveRequest(
      req.organization.id,
      id,
      req.user,
      reviewNote
    );

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Approve request error:", error);

    if (isKnownError(error)) {
      const status = error.message === "Approval request not found" ? 404 : 400;
      return res.status(status).json({ success: false, error: error.message });
    }

    return res.status(500).json({ success: false, error: "Unable to approve request" });
  }
}

export async function rejectRequestController(req: OrganizationRequest, res: Response) {
  try {
    if (!req.organization || !req.user) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ success: false, error: "Approval request ID is required" });
    }

    const reviewNote =
      typeof req.body?.reviewNote === "string" ? req.body.reviewNote.trim() || null : null;

    const data = await rejectRequest(
      req.organization.id,
      id,
      req.user,
      reviewNote
    );

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Reject request error:", error);

    if (isKnownError(error)) {
      const status = error.message === "Approval request not found" ? 404 : 400;
      return res.status(status).json({ success: false, error: error.message });
    }

    return res.status(500).json({ success: false, error: "Unable to reject request" });
  }
}
