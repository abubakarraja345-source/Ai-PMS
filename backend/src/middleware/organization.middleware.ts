import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "./auth.middleware";
import { supabase } from "../config/supabase";

export interface OrganizationRequest extends AuthenticatedRequest {
  organization?: {
    id: string;
    name: string;
    role: string;
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

    // DEBUG
    console.log("Organization lookup");
    console.log("User ID:", req.user.id);
    console.log("User email:", req.user.email);

    // 1. Find user's organization membership
    const { data: membership, error: membershipError } = await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", req.user.id)
      .limit(1)
      .maybeSingle();

    console.log("Membership:", membership);
    console.log("Membership error:", membershipError);

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

    console.log("Organization:", organization);
    console.log("Organization error:", organizationError);

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
    req.organization = {
      id: organization.id,
      name: organization.name,
      role: membership.role,
    };

    console.log("Organization attached:", req.organization);

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