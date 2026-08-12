import { Router, Request, Response } from "express";

import { requireAuth } from "../../../middleware/auth.middleware";
import { requireOrganization } from "../../../middleware/organization.middleware";
import { requireRole } from "../../../middleware/role.middleware";
import { env } from "../../../config/env";

import {
  getStatusController,
  connectController,
  callbackController,
  disconnectController,
  listListingsController,
  listMappedListingsController,
  importListingController,
  unmapListingController,
  syncController,
} from "./controller";

import { isMockAdapterAllowed } from "./mockAdapter";

const router = Router();

const manage = requireRole("owner", "company_admin");

// GET /api/integrations/airbnb/status — any org member may view
// connection status (matches GET /api/integrations' own read gate).
router.get("/status", requireAuth, requireOrganization, getStatusController);

// Everything below mutates a connection, credentials, or mappings —
// owner/company_admin only, exactly matching the existing iCal
// connect/manage gate in integrations/routes.ts.
router.post("/connect", requireAuth, requireOrganization, manage, connectController);
router.post("/callback", requireAuth, requireOrganization, manage, callbackController);
router.post("/disconnect", requireAuth, requireOrganization, manage, disconnectController);
router.get("/listings", requireAuth, requireOrganization, manage, listListingsController);
router.get("/mapped-listings", requireAuth, requireOrganization, manage, listMappedListingsController);
router.post("/listings/import", requireAuth, requireOrganization, manage, importListingController);
router.delete("/listings/:linkId", requireAuth, requireOrganization, manage, unmapListingController);
router.post("/sync", requireAuth, requireOrganization, manage, syncController);

/**
 * Development-only stand-in for "the user authorized the app on
 * Airbnb's own site and got redirected back." Registered as a normal
 * route unconditionally (so route table shape doesn't change per
 * environment), but the handler itself returns 404 unless the mock
 * adapter is explicitly allowed (see mockAdapter.ts's guard) — a
 * production deployment can never exercise this path. Redirects to
 * the SAME frontend callback URL a real Airbnb redirect would use, so
 * the full OAuth round trip (state → "authorize" → callback → token
 * exchange) is exercised end-to-end by tests without a browser.
 */
router.get("/mock-authorize", (req: Request, res: Response) => {
  if (!isMockAdapterAllowed()) {
    return res.status(404).json({
      success: false,
      error: "Not found",
    });
  }

  const state = typeof req.query.state === "string" ? req.query.state : "";
  const frontendUrl = env.frontendUrl || "http://localhost:3000";
  const code = `mock-code-${Date.now()}`;

  return res.redirect(
    `${frontendUrl}/integrations/airbnb/callback?state=${encodeURIComponent(
      state
    )}&code=${encodeURIComponent(code)}`
  );
});

export default router;
