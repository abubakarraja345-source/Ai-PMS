import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "./auth.middleware";
import { supabase } from "../config/supabase";

/**
 * Confirmed via read-only inspection: the live data only ever
 * had "owner" (the schema's own default, "company_admin", was
 * never actually used by any row) and no CHECK constraint
 * exists. These three values are the approved role vocabulary
 * for role enforcement, not something discovered in data.
 */
export const ORGANIZATION_ROLES = [
  "owner",
  "company_admin",
  "member",
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