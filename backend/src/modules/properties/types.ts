export interface Property {
  id: string;
  organization_id: string;
  title: string;
  property_type: string;
  description: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  beds: number | null;
  max_guests: number | null;
  check_in_time: string | null;
  check_out_time: string | null;
  wifi_name: string | null;
  wifi_password: string | null;
  house_manual_url: string | null;
  status: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PropertyListItem {
  id: string;
  title: string;
  property_type: string;
  description: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  beds: number | null;
  max_guests: number | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
}