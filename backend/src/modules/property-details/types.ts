export interface AmenityRow {
  id: string;
  property_id: string;
  amenity_name: string;
  amenity_category: string | null;
  created_at: string;
}

export interface Amenity {
  id: string;
  name: string;
  category: string | null;
  createdAt: string;
}

export interface RuleRow {
  id: string;
  property_id: string;
  rule_title: string;
  rule_description: string | null;
  created_at: string;
}

export interface Rule {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
}

export interface DocumentRow {
  id: string;
  property_id: string;
  document_name: string;
  document_type: string | null;
  document_url: string;
  uploaded_by: string | null;
  created_at: string;
}

export interface PropertyDocument {
  id: string;
  name: string;
  documentType: string | null;
  signedUrl: string | null;
  createdAt: string;
}
