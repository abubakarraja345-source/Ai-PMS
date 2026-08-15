import { Request, Response } from "express";
import { OrganizationRequest } from "../../middleware/organization.middleware";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";

import {
  listMembers,
  changeMemberRole,
  removeMember,
  createOrganization,
  registerOrganization,
  loginWithPassword,
} from "./service";

import { validateChangeRole } from "./validation";
import { ROLE_LABELS } from "../permissions/roles";
import { getEffectivePermissions } from "../permissions/service";
import { findPlatformAdminByUserId } from "../platformAdmin/repository";

/**
 * Our own validation/business-rule checks throw plain `Error`s
 * with friendly, intentional messages — safe to forward as
 * 400s. Supabase/Postgres failures throw PostgrestError (which
 * also extends Error) and must not reach the client — those
 * fall through to a generic sanitized 500 instead.
 */
function isKnownError(error: unknown): error is Error {
  return (
    error instanceof Error && error.name !== "PostgrestError"
  );
}

export async function listMembersController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({
        success: false,
        error: "Organization context is required",
      });
    }

    const data = await listMembers(req.organization.id);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("List members error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to load organization members",
    });
  }
}

export async function changeMemberRoleController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization || !req.user) {
      return res.status(403).json({
        success: false,
        error: "Organization context is required",
      });
    }

    const { role } = validateChangeRole(req.body);

    const updated = await changeMemberRole(
      req.organization.id,
      req.user.id,
      req.params.id,
      role,
      req.user.email
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: "Member not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Change member role error:", error);

    if (isKnownError(error)) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Unable to change member role",
    });
  }
}

export async function removeMemberController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization || !req.user) {
      return res.status(403).json({
        success: false,
        error: "Organization context is required",
      });
    }

    const removed = await removeMember(
      req.organization.id,
      req.user.id,
      req.params.id,
      req.user.email
    );

    if (!removed) {
      return res.status(404).json({
        success: false,
        error: "Member not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Member removed successfully",
    });
  } catch (error) {
    console.error("Remove member error:", error);

    if (isKnownError(error)) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Unable to remove member",
    });
  }
}

/**
 * GET /api/organization/me — thin wrapper around requireOrganization,
 * which has already resolved (or rejected, with its own 401/403)
 * the caller's organization context by the time this runs. Used by
 * the frontend to decide dashboard vs. onboarding without duplicating
 * that resolution logic client-side.
 *
 * Phase 7 — additively extended with the caller's effective
 * permissions, computed by the exact same getEffectivePermissions()
 * function requirePermission() itself calls to enforce every route
 * (see permissions/service.ts) — this is what guarantees the
 * frontend's can()/effectOf() UI hints can never drift out of sync
 * with what the backend actually enforces. `id`/`name`/`role` are
 * untouched, so no existing frontend code reading this response
 * breaks.
 */
export async function getMyOrganizationController(
  req: OrganizationRequest,
  res: Response
) {
  if (!req.organization) {
    return res.status(403).json({
      success: false,
      error: "Organization context is required",
    });
  }

  try {
    const [{ permissions, permissionEffects }, platformAdminRow] =
      await Promise.all([
        getEffectivePermissions(req.organization.id, req.organization.role),
        req.user ? findPlatformAdminByUserId(req.user.id) : null,
      ]);

    return res.status(200).json({
      success: true,
      data: {
        ...req.organization,
        roleLabel: ROLE_LABELS[req.organization.role],
        permissions,
        permissionEffects,
        isPlatformAdminViewing: req.isPlatformAdminOverride === true,
        // Whether this user holds platform-admin access at all (see
        // /admin) — distinct from isPlatformAdminViewing, which is
        // only true while actively inside an "Enter Organization"
        // read-only session. Lets the sidebar show a link to /admin
        // for platform admins without them having to know the URL.
        isPlatformAdmin: platformAdminRow !== null,
      },
    });
  } catch (error) {
    // Express 4 does not auto-catch async rejections — an uncaught
    // one here would crash the whole process, not just this request.
    // Falls back to the base organization payload (no permissions)
    // rather than letting a permission-lookup hiccup take the app
    // down; every existing frontend consumer already handles a
    // missing `permissions` field gracefully since it didn't exist
    // before this phase.
    console.error("Get effective permissions error:", error);

    return res.status(200).json({
      success: true,
      data: {
        ...req.organization,
        roleLabel: ROLE_LABELS[req.organization.role],
        permissions: [],
        permissionEffects: {},
        isPlatformAdminViewing: req.isPlatformAdminOverride === true,
        isPlatformAdmin: false,
      },
    });
  }
}

/**
 * POST /api/organization — onboarding's "Create Workspace" action.
 * Deliberately runs after only `requireAuth`, not `requireOrganization`
 * (the caller must NOT already have an organization to reach here at
 * all) — see createOrganization in service.ts for why.
 */
export async function createOrganizationController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    const organization = await createOrganization(req.user.id, req.body);

    return res.status(201).json({
      success: true,
      data: organization,
    });
  } catch (error) {
    console.error("Create organization error:", error);

    if (isKnownError(error)) {
      const status =
        error.message === "You already belong to an organization"
          ? 409
          : 400;

      return res.status(status).json({
        success: false,
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Unable to create organization",
    });
  }
}

/**
 * POST /api/organization/register — public, no session exists yet.
 * Creates the owner's password-based account and their organization
 * in one step (see registerOrganization in service.ts). The frontend
 * signs the user in with the same credentials immediately after this
 * succeeds — this endpoint intentionally returns no session/token
 * itself, keeping session issuance solely Supabase's own
 * signInWithPassword call rather than a second, parallel mechanism.
 */
export async function registerOrganizationController(
  req: Request,
  res: Response
) {
  try {
    const organization = await registerOrganization(req.body);

    return res.status(201).json({
      success: true,
      data: organization,
    });
  } catch (error) {
    console.error("Register organization error:", error);

    if (isKnownError(error)) {
      const status = error.message.includes("already exists") ? 409 : 400;

      return res.status(status).json({
        success: false,
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Unable to complete registration",
    });
  }
}

/**
 * POST /api/organization/login — public. Proxies Supabase password
 * login through our backend purely so loginRateLimiter can gate it
 * (see routes.ts) — a direct client-side supabase-js call bypasses
 * our rate limiting entirely, only Supabase's own project-level
 * limits would apply. Always 401s on any failure, deliberately not
 * distinguishing "no such account" from "wrong password".
 */
export async function loginController(req: Request, res: Response) {
  try {
    const { email, password } = (req.body ?? {}) as {
      email?: string;
      password?: string;
    };

    const { session, user } = await loginWithPassword(
      email ?? "",
      password ?? ""
    );

    return res.status(200).json({
      success: true,
      data: { session, user },
    });
  } catch (error) {
    if (isKnownError(error)) {
      return res.status(401).json({
        success: false,
        error: error.message,
      });
    }

    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to log in",
    });
  }
}
