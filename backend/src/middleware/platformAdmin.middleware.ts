import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "./auth.middleware";
import { findPlatformAdminByUserId } from "../modules/platformAdmin/repository";

export interface PlatformAdminRequest extends AuthenticatedRequest {
  platformAdmin?: {
    id: string;
    userId: string;
    label: string | null;
  };
}

/**
 * Platform-admin authorization — deliberately independent of
 * requireOrganization: a platform admin almost certainly has no
 * organization_members row at all (nothing requires one), so this
 * never calls it. Same underlying Supabase JWT auth as every other
 * route (requireAuth must run first); the only new check is a SELECT
 * against platform_admins, a table that only a human running SQL
 * directly in the Supabase Dashboard can ever INSERT into (see
 * 20260817010000_platform_admins.sql's SELECT-only grant) — so this
 * middleware can trust that a matching row means real, deliberately
 * granted platform-admin status.
 */
export async function requirePlatformAdmin(
  req: PlatformAdminRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    const admin = await findPlatformAdminByUserId(req.user.id);

    if (!admin) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to perform this action",
      });
    }

    req.platformAdmin = {
      id: admin.id,
      userId: admin.user_id,
      label: admin.label,
    };

    next();
  } catch (error) {
    console.error("Platform admin middleware error:", error);

    return res.status(500).json({
      success: false,
      error: "Platform admin service error",
    });
  }
}
