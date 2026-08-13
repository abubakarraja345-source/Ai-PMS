import { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import { AuthenticatedRequest } from "./auth.middleware";
import { supabase } from "../config/supabase";
import { env } from "../config/env";

/**
 * Shape of the signed platform-admin "entered organization" session
 * token (minted by platformAdmin/service.ts's enterOrganization).
 * Defined here rather than imported from the platformAdmin module to
 * avoid a circular import (platformAdmin/service.ts already imports
 * from organization/service.ts, which imports OrganizationRole from
 * this file) — platformAdmin/service.ts imports this type FROM here
 * instead, keeping the dependency direction one-way.
 */
export interface PlatformAdminSessionPayload {
  platformAdminId: string;
  platformAdminUserId: string;
  organizationId: string;
  organizationName: string;
  reason: string;
}

/**
 * Phase 7 — widened from the original 3 (owner/company_admin/member)
 * to the full 6-tier org role model. "company_admin" is kept as the
 * stored value for what the permission system labels "Admin"
 * everywhere else (see permissions/roles.ts's ROLE_LABELS) — a
 * label mapping, not a data rename, so no existing row needs to
 * change. The role column itself has no CHECK constraint at the
 * database level (confirmed via schema inspection), so this widening
 * needs no migration here; only organization_invitations' role CHECK
 * needed one (see 20260817000000_widen_invitation_roles.sql).
 */
export const ORGANIZATION_ROLES = [
  "owner",
  "company_admin",
  "manager",
  "host",
  "member",
  "spectator",
] as const;

export type OrganizationRole =
  (typeof ORGANIZATION_ROLES)[number];

export function isOrganizationRole(
  value: string
): value is OrganizationRole {
  return (ORGANIZATION_ROLES as readonly string[]).includes(
    value
  );
}

export interface OrganizationRequest extends AuthenticatedRequest {
  organization?: {
    id: string;
    name: string;
    role: OrganizationRole;
  };
  /** True only when req.organization was populated from a platform
   * admin's "entered organization" session, not a real membership
   * row. Controllers/responses can use this to surface the "Viewing
   * as Platform Administrator" context to the frontend. */
  isPlatformAdminOverride?: boolean;
}

const PLATFORM_ADMIN_SESSION_HEADER = "x-platform-admin-session";

/**
 * Verifies an X-Platform-Admin-Session header (if present) and — this
 * is the important part — pins it to the ACTUAL authenticated caller
 * (req.user.id must equal the token's platformAdminUserId). Without
 * that pin, a leaked/replayed header value would grant organization
 * access to whichever ordinary authenticated user presented it, even
 * one who is a member of a completely different organization and not
 * a platform admin at all. Returns null (falls through to normal
 * membership resolution) for anything invalid, expired, tampered, or
 * simply absent — this must never throw.
 */
function resolvePlatformAdminOverride(
  req: OrganizationRequest
): { id: string; name: string; role: OrganizationRole } | null {
  const header = req.headers[PLATFORM_ADMIN_SESSION_HEADER];
  const token = typeof header === "string" ? header : null;

  if (!token || !env.jwtSecret || !req.user) {
    return null;
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret) as PlatformAdminSessionPayload;

    if (payload.platformAdminUserId !== req.user.id) {
      return null;
    }

    return {
      id: payload.organizationId,
      name: payload.organizationName,
      // A platform admin views an organization with owner-level
      // read access — moot in practice, since the read-only block
      // below rejects every mutating request regardless of role.
      role: "owner",
    };
  } catch {
    return null;
  }
}

export async function requireOrganization(
  req: OrganizationRequest,
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

    const override = resolvePlatformAdminOverride(req);

    if (override) {
      // Single choke point for "platform admin sessions are
      // read-only" — every route reachable through requireOrganization
      // is protected here, before any handler runs, rather than
      // trusting each individual route file to remember a check.
      if (!["GET", "HEAD"].includes(req.method)) {
        return res.status(403).json({
          success: false,
          error: "Platform admin sessions are read-only",
        });
      }

      req.organization = override;
      req.isPlatformAdminOverride = true;
      return next();
    }

    // 1. Find user's organization membership
    const { data: membership, error: membershipError } = await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", req.user.id)
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      console.error(
        "FULL MEMBERSHIP ERROR:",
        JSON.stringify(membershipError, null, 2)
      );

      return res.status(500).json({
        success: false,
        error: "Unable to determine organization",
      });
    }

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: "User is not a member of an organization",
      });
    }

    // 2. Find organization
    const { data: organization, error: organizationError } =
      await supabase
        .from("organizations")
        .select("id, name")
        .eq("id", membership.organization_id)
        .maybeSingle();

    if (organizationError) {
      console.error(
        "FULL ORGANIZATION ERROR:",
        JSON.stringify(organizationError, null, 2)
      );

      return res.status(500).json({
        success: false,
        error: "Unable to load organization",
      });
    }

    if (!organization) {
      return res.status(404).json({
        success: false,
        error: "Organization not found",
      });
    }

    // 3. Attach organization context
    //
    // The role column has no CHECK constraint at the database
    // level (confirmed via schema inspection). If a row ever
    // holds something outside the three approved values, fail
    // safe to the least-privileged role rather than trusting an
    // unrecognized string or crashing the request.
    const role: OrganizationRole = isOrganizationRole(
      membership.role
    )
      ? membership.role
      : "member";

    if (role !== membership.role) {
      console.warn(
        "Unrecognized organization role in database, defaulting to 'member':",
        membership.role
      );
    }

    req.organization = {
      id: organization.id,
      name: organization.name,
      role,
    };

    next();
  } catch (error) {
    console.error(
      "Organization middleware error:",
      JSON.stringify(error, null, 2)
    );

    return res.status(500).json({
      success: false,
      error: "Organization service error",
    });
  }
}