import { Router } from "express";

import {
  requireAuth,
} from "../../middleware/auth.middleware";

import {
  requireOrganization,
} from "../../middleware/organization.middleware";

import {
  GuestsController,
} from "./controller";

export const GuestsRouter =
  Router();

GuestsRouter.use(requireAuth);
GuestsRouter.use(requireOrganization);

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
  GuestsController.remove
);
