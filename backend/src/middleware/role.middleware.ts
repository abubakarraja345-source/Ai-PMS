import { NextFunction, Response } from "express";
import {
  OrganizationRequest,
  OrganizationRole,
} from "./organization.middleware";

/**
 * Coarse-grained role gate, composed after requireOrganization
 * (which must run first to populate req.organization.role).
 *
 * This only answers "is the caller's role one of the roles
 * allowed to even attempt this endpoint at all" — it does not
 * (and cannot, since it has no knowledge of the specific
 * resource being acted on) express finer rules like "an owner
 * can never be removed" or "you cannot change your own role".
 * Those live in each operation's service layer, matching how
 * every other module's business rules (e.g. Cleaning/
 * Maintenance status transitions) are implemented in this
 * codebase — middleware handles coarse authorization, service
 * functions handle rules that depend on which specific record
 * is being touched.
 */
export function requireRole(...allowedRoles: OrganizationRole[]) {
  return function (
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

    if (!allowedRoles.includes(req.organization.role)) {
      return res.status(403).json({
        success: false,
        error:
          "You do not have permission to perform this action",
      });
    }

    next();
  };
}
