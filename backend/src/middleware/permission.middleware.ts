import { NextFunction, Response } from "express";
import { OrganizationRequest } from "./organization.middleware";
import { getEffect } from "../modules/permissions/service";
import { ResourceAction } from "../modules/permissions/resourceActions";

/**
 * The fine-grained successor to requireRole — same position in the
 * middleware chain (requireAuth -> requireOrganization ->
 * requirePermission -> controller), same 403 JSON shape, so migrating
 * a route from requireRole(...) to requirePermission(...) is a
 * one-line swap. requireRole itself is NOT removed or modified by
 * this addition; it continues to gate every route not explicitly
 * migrated (see permissions/matrix.ts's own comment on why that's
 * fine, not technical debt).
 *
 * Both "allow" and "approval" proceed past this coarse gate — a
 * caller whose role resolves to "approval" for this action IS
 * authorized to attempt it; whether the specific request gets applied
 * immediately or deferred into the approval workflow is a
 * field/payload-level decision made deeper in the handler (see
 * modules/approvals/interceptor.ts), which this middleware has no way
 * to know from the resource.action alone.
 */
export function requirePermission(resourceAction: ResourceAction) {
  return async function (
    req: OrganizationRequest,
    res: Response,
    next: NextFunction
  ) {
    if (!req.organization) {
      return res.status(403).json({
        success: false,
        error: "Organization context is required",
      });
    }

    try {
      const effect = await getEffect(
        req.organization.id,
        req.organization.role,
        resourceAction
      );

      if (effect === "deny") {
        return res.status(403).json({
          success: false,
          error: "You do not have permission to perform this action",
        });
      }

      next();
    } catch (error) {
      console.error("Permission check error:", error);

      return res.status(500).json({
        success: false,
        error: "Unable to verify permissions",
      });
    }
  };
}
