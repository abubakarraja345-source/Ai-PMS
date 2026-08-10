import { validateDate } from "../reservations/validation";

export interface CalendarQuery {
  start: string;
  end: string;
  property_id?: string;
}

export function validateCalendarQuery(
  query: Record<string, unknown>
): CalendarQuery {
  const start = validateDate(query.start, "start");
  const end = validateDate(query.end, "end");

  const startTimestamp = new Date(
    `${start}T00:00:00Z`
  ).getTime();

  const endTimestamp = new Date(
    `${end}T00:00:00Z`
  ).getTime();

  if (endTimestamp <= startTimestamp) {
    throw new Error("end must be after start");
  }

  let propertyId: string | undefined;

  if (
    query.property_id !== undefined &&
    query.property_id !== ""
  ) {
    if (
      typeof query.property_id !== "string" ||
      !query.property_id.trim()
    ) {
      throw new Error(
        "property_id must be a valid string"
      );
    }

    propertyId = query.property_id.trim();
  }

  return {
    start,
    end,
    ...(propertyId !== undefined
      ? { property_id: propertyId }
      : {}),
  };
}
