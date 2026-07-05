// Standard paginated response wrapper used by list endpoints.
// Consumers can rely on this shape being consistent across all resources.

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    perPage: number;
    hasMore: boolean;
  };
}

export function paginate<T>(
  data: T[],
  total: number,
  page: number,
  perPage: number
): PaginatedResult<T> {
  return {
    data,
    meta: {
      total,
      page,
      perPage,
      hasMore: page * perPage < total,
    },
  };
}

export function parsePaginationQuery(query: Record<string, string | undefined>): {
  page: number;
  perPage: number;
  offset: number;
} {
  const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(query.perPage ?? '25', 10) || 25));
  return { page, perPage, offset: (page - 1) * perPage };
}
