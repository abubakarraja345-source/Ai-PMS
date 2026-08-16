import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware";
import { requireOrganization } from "../../middleware/organization.middleware";
import { requireRole } from "../../middleware/role.middleware";

import {
  channelOverviewController,
  connectPropertyCalendarController,
  createIntegrationController,
  createPropertyFromIcalController,
  deleteIntegrationController,
  disableIntegrationController,
  enableIntegrationController,
  getIntegrationController,
  listIntegrationsController,
  manualSyncController,
  syncHistoryController,
  testConnectionController,
  testIcalUrlController,
  updateIntegrationController,
} from "./controller";

import {
  listChannelLinksController,
  createChannelLinkController,
  deleteChannelLinkController,
} from "./channelLinks.controller";

const router = Router();

router.use(requireAuth, requireOrganization);

const mutate = requireRole("owner", "company_admin");

// Registered before the generic "/:id" routes below — "/:id" would
// otherwise greedily match a literal "/channel-links" request first
// (Express matches by registration order, and ":id" matches any
// single path segment, including the literal string "channel-links").
// Phase 6B — unified per-property "which channel actually feeds this
// property" read. Registered before "/:id" for the same reason as
// channel-links/ical below: "overview" would otherwise be captured as
// an :id param.
router.get("/overview", channelOverviewController);

router.get("/channel-links", listChannelLinksController);
router.post("/channel-links", mutate, createChannelLinkController);
router.delete("/channel-links/:id", mutate, deleteChannelLinkController);

// Test a feed URL before saving it as a connection, and the "save"
// step itself — same reasoning as channel-links above: registered
// before "/:id" so the literal segment "ical" is never captured as an
// :id param.
router.post("/ical/test", mutate, testIcalUrlController);
router.post("/ical/create-property", mutate, createPropertyFromIcalController);
router.post("/ical", mutate, connectPropertyCalendarController);

router.get("/", listIntegrationsController);
router.post("/", mutate, createIntegrationController);
router.get("/:id", getIntegrationController);
router.patch("/:id", mutate, updateIntegrationController);
router.delete("/:id", mutate, deleteIntegrationController);
router.post("/:id/enable", mutate, enableIntegrationController);
router.post("/:id/disable", mutate, disableIntegrationController);
router.post("/:id/test", mutate, testConnectionController);
router.post("/:id/sync", mutate, manualSyncController);
router.get("/:id/sync-history", syncHistoryController);

export default router;
