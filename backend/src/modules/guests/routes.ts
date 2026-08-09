import { Router } from "express";

import {
  requireAuth,
} from "../../middleware/auth.middleware";

import {
  GuestsController,
} from "./controller";

export const GuestsRouter =
  Router();

GuestsRouter.use(requireAuth);

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