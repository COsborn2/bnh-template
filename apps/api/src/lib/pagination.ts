import { badRequest } from "./errors.js";

/**
 * Shared list-endpoint helpers. Admin list screens page through 20 rows at a
 * time; callers may ask for more, up to `MAX_PAGE_SIZE`, so an export or a
 * scripted client can pull bigger batches without an unbounded query.
 */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export function parseNonNegativeInt(
  value: string | undefined,
  fallback: number,
): number {
  // Treat an empty param (`?limit=`) as absent — `Number("")` is 0, which
  // would otherwise silently return an empty page.
  if (value === undefined || value === "") return fallback;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw badRequest("Invalid pagination parameter");
  }

  return parsed;
}

export function readEnumParam<const T extends readonly string[]>(
  value: string | undefined,
  allowed: T,
  fallback: T[number],
): T[number] {
  if (value === undefined || value === "") return fallback;
  if ((allowed as readonly string[]).includes(value)) return value as T[number];
  throw badRequest("Invalid filter parameter");
}

export function readPagination(
  query: { limit?: string; offset?: string },
  options: { defaultLimit?: number; maxLimit?: number } = {},
): { limit: number; offset: number } {
  const defaultLimit = options.defaultLimit ?? DEFAULT_PAGE_SIZE;
  const maxLimit = options.maxLimit ?? MAX_PAGE_SIZE;

  return {
    limit: Math.min(parseNonNegativeInt(query.limit, defaultLimit), maxLimit),
    offset: parseNonNegativeInt(query.offset, 0),
  };
}
