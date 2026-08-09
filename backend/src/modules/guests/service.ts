import { supabase } from "../../config/supabase";

import {
  findGuestsByOrganization,
  findGuestById,
  createGuest,
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