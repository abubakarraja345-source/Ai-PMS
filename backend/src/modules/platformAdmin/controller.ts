import { Response } from "express";
import { PlatformAdminRequest } from "../../middleware/platformAdmin.middleware";

import {
  getPlatformStats,
  listOrganizationHealth,
  getOrganizationDetail,
  setOrganizationSuspension,
  enterOrganization,
  exitOrganization,
  listPlatformAdminAuditLog,
  getPlatformCalendar,
  getPlatformReports,
  getPlatformInsights,
  PlatformAdminSessionSigningNotConfiguredError,
} from "./service";

function isKnownError(error: unknown): error is Error {
  return error instanceof Error && error.name !== "PostgrestError";
}

function requirePlatformAdminContext(
  req: PlatformAdminRequest,
  res: Response
): boolean {
  if (!req.platformAdmin || !req.user) {
    res.status(403).json({ success: false, error: "Platform admin access required" });
    return false;
  }
  return true;
}

export async function getPlatformStatsController(req: PlatformAdminRequest, res: Response) {
  try {
    if (!requirePlatformAdminContext(req, res)) return;

    const data = await getPlatformStats();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Platform stats error:", error);
    return res.status(500).json({ success: false, error: "Unable to load platform statistics" });
  }
}

export async function listOrganizationsController(req: PlatformAdminRequest, res: Response) {
  try {
    if (!requirePlatformAdminContext(req, res)) return;

    const data = await listOrganizationHealth();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Platform organization list error:", error);
    return res.status(500).json({ success: false, error: "Unable to load organizations" });
  }
}

export async function getOrganizationDetailController(req: PlatformAdminRequest, res: Response) {
  try {
    if (!requirePlatformAdminContext(req, res)) return;

    const orgId = req.params.orgId;
    if (!orgId) {
      return res.status(400).json({ success: false, error: "Organization ID is required" });
    }

    const data = await getOrganizationDetail(orgId);

    if (!data) {
      return res.status(404).json({ success: false, error: "Organization not found" });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Platform organization detail error:", error);
    return res.status(500).json({ success: false, error: "Unable to load organization detail" });
  }
}

export async function suspendOrganizationController(req: PlatformAdminRequest, res: Response) {
  try {
    if (!requirePlatformAdminContext(req, res)) return;

    const orgId = req.params.orgId;
    if (!orgId) {
      return res.status(400).json({ success: false, error: "Organization ID is required" });
    }

    const data = await setOrganizationSuspension(orgId, true, {
      platformAdminId: req.platformAdmin!.id,
      userId: req.user!.id,
      email: req.user!.email ?? null,
    });

    if (!data) {
      return res.status(404).json({ success: false, error: "Organization not found" });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Suspend organization error:", error);
    return res.status(500).json({ success: false, error: "Unable to suspend organization" });
  }
}

export async function reactivateOrganizationController(req: PlatformAdminRequest, res: Response) {
  try {
    if (!requirePlatformAdminContext(req, res)) return;

    const orgId = req.params.orgId;
    if (!orgId) {
      return res.status(400).json({ success: false, error: "Organization ID is required" });
    }

    const data = await setOrganizationSuspension(orgId, false, {
      platformAdminId: req.platformAdmin!.id,
      userId: req.user!.id,
      email: req.user!.email ?? null,
    });

    if (!data) {
      return res.status(404).json({ success: false, error: "Organization not found" });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Reactivate organization error:", error);
    return res.status(500).json({ success: false, error: "Unable to reactivate organization" });
  }
}

export async function enterOrganizationController(req: PlatformAdminRequest, res: Response) {
  try {
    if (!requirePlatformAdminContext(req, res)) return;

    const orgId = req.params.orgId;
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";

    if (!orgId) {
      return res.status(400).json({ success: false, error: "Organization ID is required" });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: "A reason is required to view an organization as a platform administrator",
      });
    }

    const data = await enterOrganization(orgId, reason, {
      platformAdminId: req.platformAdmin!.id,
      userId: req.user!.id,
      email: req.user!.email ?? null,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Enter organization error:", error);

    if (error instanceof PlatformAdminSessionSigningNotConfiguredError) {
      return res.status(500).json({ success: false, error: error.message });
    }

    if (isKnownError(error)) {
      return res.status(404).json({ success: false, error: error.message });
    }

    return res.status(500).json({ success: false, error: "Unable to enter organization" });
  }
}

export async function exitOrganizationController(req: PlatformAdminRequest, res: Response) {
  try {
    if (!requirePlatformAdminContext(req, res)) return;

    const orgId = req.params.orgId;
    if (!orgId) {
      return res.status(400).json({ success: false, error: "Organization ID is required" });
    }

    await exitOrganization(orgId, {
      platformAdminId: req.platformAdmin!.id,
      userId: req.user!.id,
      email: req.user!.email ?? null,
    });

    return res.status(200).json({ success: true, message: "Exited organization view" });
  } catch (error) {
    console.error("Exit organization error:", error);
    return res.status(500).json({ success: false, error: "Unable to record exit" });
  }
}

export async function listPlatformAuditLogController(req: PlatformAdminRequest, res: Response) {
  try {
    if (!requirePlatformAdminContext(req, res)) return;

    const page = Number(req.query.page) || 1;
    const organizationId =
      typeof req.query.organization_id === "string" ? req.query.organization_id : undefined;

    const data = await listPlatformAdminAuditLog(
      organizationId ? { organizationId } : {},
      page
    );

    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    console.error("Platform audit log error:", error);
    return res.status(500).json({ success: false, error: "Unable to load platform audit log" });
  }
}

/**
 * GET /api/platform-admin/calendar?start=...&end=...
 * Both required — same "no default range" posture as the org-level
 * calendar endpoint, since silently defaulting a cross-org query
 * risks an unexpectedly huge response.
 */
export async function getPlatformCalendarController(req: PlatformAdminRequest, res: Response) {
  try {
    if (!requirePlatformAdminContext(req, res)) return;

    const start = typeof req.query.start === "string" ? req.query.start : "";
    const end = typeof req.query.end === "string" ? req.query.end : "";

    if (!start || !end) {
      return res.status(400).json({ success: false, error: "start and end are required" });
    }

    const data = await getPlatformCalendar(start, end);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Platform calendar error:", error);
    return res.status(500).json({ success: false, error: "Unable to load platform calendar" });
  }
}

export async function getPlatformReportsController(req: PlatformAdminRequest, res: Response) {
  try {
    if (!requirePlatformAdminContext(req, res)) return;

    const data = await getPlatformReports();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Platform reports error:", error);
    return res.status(500).json({ success: false, error: "Unable to load platform reports" });
  }
}

export async function getPlatformInsightsController(req: PlatformAdminRequest, res: Response) {
  try {
    if (!requirePlatformAdminContext(req, res)) return;

    const data = await getPlatformInsights();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Platform insights error:", error);
    return res.status(500).json({ success: false, error: "Unable to load platform insights" });
  }
}
