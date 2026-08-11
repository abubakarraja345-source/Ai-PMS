export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function parsePositiveInt(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = Number(value.trim());

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
}

/**
 * Parses `page`/`limit` query params, silently falling back to safe
 * defaults for anything missing or malformed rather than throwing —
 * unlike a bad filter value (a real user error worth a 400), a bad
 * page number just isn't a page anyone can reach, so degrading to
 * page 1 is friendlier than failing the whole request.
 */
export function parsePagination(
  query: Record<string, unknown>
): PaginationParams {
  const page = parsePositiveInt(query.page) ?? DEFAULT_PAGE;
  const rawLimit = parsePositiveInt(query.limit) ?? DEFAULT_LIMIT;
  const limit = Math.min(rawLimit, MAX_LIMIT);

  return { page, limit };
}

/**
 * Zero-indexed [from, to] bounds for Supabase's `.range()`, inclusive
 * on both ends.
 */
export function getRange(
  page: number,
  limit: number
): { from: number; to: number } {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  return { from, to };
}

export function buildPaginationMeta(
  page: number,
  limit: number,
  total: number
): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}
