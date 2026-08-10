export interface PropertyImageRow {
  id: string;
  property_id: string;
  image_url: string;
  alt_text: string | null;
  display_order: number;
  is_cover: boolean;
  created_at: string;
}

export interface PropertyImage {
  id: string;
  altText: string | null;
  displayOrder: number;
  isCover: boolean;
  signedUrl: string | null;
  createdAt: string;
}
