import {
  buildPaginatedResult,
  parsePaginationParams,
  type PaginatedResult,
} from "@renis/core/pagination";

type FindManyArgs = {
  where?: object;
  orderBy?: object;
  include?: object;
  select?: object;
};

type PrismaDelegate<T> = {
  count: (args: { where?: object }) => Promise<number>;
  findMany: (args: FindManyArgs & { skip?: number; take?: number }) => Promise<T[]>;
};

/** Paginated findMany, or full list when `all=true`. */
export async function paginatedQuery<T>(
  searchParams: URLSearchParams,
  delegate: PrismaDelegate<T>,
  args: FindManyArgs
): Promise<PaginatedResult<T> | T[]> {
  if (searchParams.get("all") === "true") {
    return delegate.findMany(args);
  }

  const { page, pageSize, skip, take } = parsePaginationParams(searchParams);
  const where = args.where;

  const [total, items] = await Promise.all([
    delegate.count({ where }),
    delegate.findMany({ ...args, where, skip, take }),
  ]);

  return buildPaginatedResult(items, total, page, pageSize);
}
