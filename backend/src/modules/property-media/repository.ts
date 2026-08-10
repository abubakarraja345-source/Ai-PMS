import { supabase } from "../../config/supabase";
import { PropertyImageRow } from "./types";

const IMAGE_SELECT =
  "id, property_id, image_url, alt_text, display_order, is_cover, created_at";

export async function findImagesByProperty(
  propertyId: string
): Promise<PropertyImageRow[]> {
  const { data, error } = await supabase
    .from("property_images")
    .select(IMAGE_SELECT)
    .eq("property_id", propertyId)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function countImagesByProperty(
  propertyId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("property_images")
    .select("id", { count: "exact", head: true })
    .eq("property_id", propertyId);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function findImageById(
  propertyId: string,
  imageId: string
): Promise<PropertyImageRow | null> {
  const { data, error } = await supabase
    .from("property_images")
    .select(IMAGE_SELECT)
    .eq("id", imageId)
    .eq("property_id", propertyId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function createImageRow(
  propertyId: string,
  input: {
    imagePath: string;
    altText: string | null;
    displayOrder: number;
    isCover: boolean;
  }
): Promise<PropertyImageRow> {
  const { data, error } = await supabase
    .from("property_images")
    .insert({
      property_id: propertyId,
      image_url: input.imagePath,
      alt_text: input.altText,
      display_order: input.displayOrder,
      is_cover: input.isCover,
    })
    .select(IMAGE_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateImageRow(
  propertyId: string,
  imageId: string,
  updates: Record<string, unknown>
): Promise<PropertyImageRow | null> {
  const { data, error } = await supabase
    .from("property_images")
    .update(updates)
    .eq("id", imageId)
    .eq("property_id", propertyId)
    .select(IMAGE_SELECT)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function clearCoverForProperty(
  propertyId: string
): Promise<void> {
  const { error } = await supabase
    .from("property_images")
    .update({ is_cover: false })
    .eq("property_id", propertyId)
    .eq("is_cover", true);

  if (error) {
    throw error;
  }
}

export async function deleteImageRow(
  propertyId: string,
  imageId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("property_images")
    .delete()
    .eq("id", imageId)
    .eq("property_id", propertyId)
    .select("id");

  if (error) {
    throw error;
  }

  return !!data && data.length > 0;
}

/** Every image path for a property — used to purge Storage objects
 * defensively when the property itself is deleted (DB rows already
 * cascade, but Storage objects do not). */
export async function findImagePathsByProperty(
  propertyId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from("property_images")
    .select("image_url")
    .eq("property_id", propertyId);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => row.image_url);
}

export async function updateDisplayOrders(
  propertyId: string,
  orderedImageIds: string[]
): Promise<void> {
  for (let index = 0; index < orderedImageIds.length; index += 1) {
    const { error } = await supabase
      .from("property_images")
      .update({ display_order: index })
      .eq("id", orderedImageIds[index])
      .eq("property_id", propertyId);

    if (error) {
      throw error;
    }
  }
}
