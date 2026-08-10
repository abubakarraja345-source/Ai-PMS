import { supabase } from "../../config/supabase";

import {
  findGuestsByOrganization,
  findGuestById,
  createGuest,
  updateGuest,
  deleteGuest,
} from "./repository";

import {
  CreateGuestInput,
} from "./validation";

/**
 * Get all guests belonging to an organization.
 */
export async function getGuests(
  organizationId: string
) {
  return findGuestsByOrganization(
    organizationId
  );
}

/**
 * Get one guest belonging to an organization.
 */
export async function getGuest(
  organizationId: string,
  guestId: string
) {
  return findGuestById(
    organizationId,
    guestId
  );
}

/**
 * Create a guest.
 */
export async function addGuest(
  organizationId: string,
  input: CreateGuestInput
) {
  return createGuest(
    organizationId,
    input
  );
}

/**
 * Edit an existing guest.
 *
 * Validates supplied fields and strips
 * protected fields before updating.
 */
export async function editGuest(
  organizationId: string,
  guestId: string,
  updates: Record<string, unknown>
) {
  const existing = await findGuestById(
    organizationId,
    guestId
  );

  if (!existing) {
    return null;
  }

  if (updates.first_name !== undefined) {
    if (
      typeof updates.first_name !== "string" ||
      !updates.first_name.trim()
    ) {
      throw new Error("First name is required");
    }

    updates.first_name = updates.first_name.trim();
  }

  const stringFields = [
    "last_name",
    "email",
    "phone",
    "country",
    "language",
    "passport_number",
    "notes",
  ];

  for (const field of stringFields) {
    if (updates[field] !== undefined) {
      const value = updates[field];

      if (value !== null && typeof value !== "string") {
        throw new Error(`${field} must be a string`);
      }

      updates[field] =
        typeof value === "string"
          ? value.trim() || null
          : null;
    }
  }

  if (updates.vip !== undefined) {
    if (typeof updates.vip !== "boolean") {
      throw new Error("vip must be a boolean");
    }
  }

  /*
   * Prevent protected fields from
   * being changed by the client.
   */
  if ("id" in updates) {
    delete updates.id;
  }

  if ("organization_id" in updates) {
    delete updates.organization_id;
  }

  if ("created_at" in updates) {
    delete updates.created_at;
  }

  return updateGuest(
    organizationId,
    guestId,
    updates
  );
}

/**
 * Delete guest.
 */
export async function removeGuest(
  organizationId: string,
  guestId: string
) {
  const existing = await findGuestById(
    organizationId,
    guestId
  );

  if (!existing) {
    return false;
  }

  return deleteGuest(
    organizationId,
    guestId
  );
}