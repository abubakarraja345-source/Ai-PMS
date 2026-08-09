import { supabase } from "../../config/supabase";
import {
  createReservation,
  deleteReservation,
  findReservationById,
  findReservationsByOrganization,
  updateReservation,
} from "./repository";
import {
  CreateReservationInput,
} from "./validation";
import { Reservation } from "./types";

export async function getReservations(
  organizationId: string
) {
  return findReservationsByOrganization(
    organizationId
  );
}

export async function getReservation(
  organizationId: string,
  reservationId: string
) {
  return findReservationById(
    organizationId,
    reservationId
  );
}

async function verifyProperty(
  organizationId: string,
  propertyId: string
) {
  const { data, error } = await supabase
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return !!data;
}

async function verifyGuest(
  organizationId: string,
  guestId: string
) {
  const { data, error } = await supabase
    .from("guests")
    .select("id")
    .eq("id", guestId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return !!data;
}

export async function addReservation(
  organizationId: string,
  input: CreateReservationInput
): Promise<Reservation> {
  const propertyExists = await verifyProperty(
    organizationId,
    input.property_id
  );

  if (!propertyExists) {
    throw new Error(
      "Property not found in your organization"
    );
  }

  const guestExists = await verifyGuest(
    organizationId,
    input.guest_id
  );

  if (!guestExists) {
    throw new Error(
      "Guest not found in your organization"
    );
  }

  return createReservation(
    organizationId,
    input
  );
}

export async function editReservation(
  organizationId: string,
  reservationId: string,
  updates: Record<string, unknown>
) {
  const existing = await findReservationById(
    organizationId,
    reservationId
  );

  if (!existing) {
    return null;
  }

  if (updates.property_id) {
    const propertyExists = await verifyProperty(
      organizationId,
      String(updates.property_id)
    );

    if (!propertyExists) {
      throw new Error(
        "Property not found in your organization"
      );
    }
  }

  if (updates.guest_id) {
    const guestExists = await verifyGuest(
      organizationId,
      String(updates.guest_id)
    );

    if (!guestExists) {
      throw new Error(
        "Guest not found in your organization"
      );
    }
  }

  return updateReservation(
    organizationId,
    reservationId,
    updates
  );
}

export async function removeReservation(
  organizationId: string,
  reservationId: string
) {
  const existing = await findReservationById(
    organizationId,
    reservationId
  );

  if (!existing) {
    return false;
  }

  return deleteReservation(
    organizationId,
    reservationId
  );
}