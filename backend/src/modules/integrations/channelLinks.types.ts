export interface PropertyChannelLinkRow {
  id: string;
  organization_id: string;
  property_id: string;
  provider: string;
  external_listing_id: string;
  created_at: string;
  updated_at: string;
}

export interface PropertyChannelLink {
  id: string;
  propertyId: string;
  provider: string;
  externalListingId: string;
  createdAt: string;
  updatedAt: string;
}
