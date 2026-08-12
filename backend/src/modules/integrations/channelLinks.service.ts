import { verifyProperty } from "../reservations/service";

import {
  findChannelLinksByOrganization,
  findChannelLinkById,
  insertChannelLink,
  deleteChannelLink,
} from "./channelLinks.repository";

import {
  CreateChannelLinkInput,
  validateCreateChannelLink,
} from "./channelLinks.validation";

import { PropertyChannelLink, PropertyChannelLinkRow } from "./channelLinks.types";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

function toClient(row: PropertyChannelLinkRow): PropertyChannelLink {
  return {
    id: row.id,
    propertyId: row.property_id,
    provider: row.provider,
    externalListingId: row.external_listing_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listChannelLinks(
  organizationId: string
): Promise<PropertyChannelLink[]> {
  const rows = await findChannelLinksByOrganization(organizationId);
  return rows.map(toClient);
}

export async function createChannelLink(
  organizationId: string,
  rawInput: unknown
): Promise<PropertyChannelLink> {
  const input: CreateChannelLinkInput = validateCreateChannelLink(rawInput);

  const propertyExists = await verifyProperty(
    organizationId,
    input.propertyId
  );

  if (!propertyExists) {
    throw new Error("Property not found in your organization");
  }

  try {
    const row = await insertChannelLink(organizationId, input);
    return toClient(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Error(
        "This property already has a link for this provider, or this listing ID is already linked to another property"
      );
    }

    throw error;
  }
}

export async function removeChannelLink(
  organizationId: string,
  linkId: string
): Promise<boolean> {
  const existing = await findChannelLinkById(organizationId, linkId);

  if (!existing) {
    return false;
  }

  return deleteChannelLink(organizationId, linkId);
}
