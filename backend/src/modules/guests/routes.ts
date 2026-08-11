import { Router } from "express";

import {
  requireAuth,
} from "../../middleware/auth.middleware";

import {
  requireOrganization,
} from "../../middleware/organization.middleware";

import { requireRole } from "../../middleware/role.middleware";

import {
  GuestsController,
} from "./controller";

export const GuestsRouter =
  Router();

GuestsRouter.use(requireAuth);
GuestsRouter.use(requireOrganization);

/**
 * Only permanent deletion of a guest record is restricted —
 * creating/editing guests remains open to every role since that is
 * routine front-desk/check-in work, not an admin action. This was a
 * pre-existing gap: any "member" could previously delete any guest
 * record (including PII like passport_number) with no role check.
 */
const destructive = requireRole("owner", "company_admin");

// GET /api/guests
GuestsRouter.get(
  "/",
  GuestsController.getAll
);

// GET /api/guests/:id
GuestsRouter.get(
  "/:id",
  GuestsController.getOne
);

// POST /api/guests
GuestsRouter.post(
  "/",
  GuestsController.create
);

// PATCH /api/guests/:id
GuestsRouter.patch(
  "/:id",
  GuestsController.update
);

// DELETE /api/guests/:id
GuestsRouter.delete(
  "/:id",
  destructive,
  GuestsController.remove
);
