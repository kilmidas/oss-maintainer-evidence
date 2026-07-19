import { GhApiError, runGhApi } from "../process/gh-runner.js";
import type { BuiltEndpoint } from "./contracts.js";
import { buildEndpoint, ENDPOINTS } from "./endpoints.js";
import { repositorySchema, searchSchema } from "./schemas.js";

export interface ClientOptions {
  run?: (
    endpoint: BuiltEndpoint,
  ) => Promise<Awaited<ReturnType<typeof runGhApi>>>;
}
export interface PublicRepository {
  owner: string;
  repo: string;
  fullName: string;
  defaultBranch: string;
  fork: boolean;
}
export interface PageResult<T> {
  items: T[];
  fetched: number;
  truncated: boolean;
}
const nextUrl = (link?: string) =>
  link
    ?.split(",")
    .map((x) => x.trim())
    .find((x) => /;\s*rel="?next"?/i.test(x))
    ?.match(/<([^>]+)>/)?.[1];
const endpointFromUrl = (
  url: string,
  contract: typeof ENDPOINTS.releases | typeof ENDPOINTS.searchIssues,
): BuiltEndpoint => {
  const u = new URL(url);
  if (
    u.protocol !== "https:" ||
    u.hostname !== "github.com" ||
    u.port ||
    u.username ||
    u.password
  )
    throw new GhApiError("protocol");
  if (contract === ENDPOINTS.searchIssues) {
    if (u.pathname !== "/search/issues") throw new GhApiError("protocol");
    const q = u.searchParams.get("q");
    if (!q) throw new GhApiError("protocol");
    return buildEndpoint(contract, {
      q,
      page: Number(u.searchParams.get("page") ?? 1),
      per_page: Number(u.searchParams.get("per_page") ?? 100),
    });
  }
  const m = u.pathname.match(/^\/repos\/([^/]+)\/([^/]+)\/releases$/);
  if (!m) throw new GhApiError("protocol");
  return buildEndpoint(contract, {
    owner: decodeURIComponent(m[1]),
    repo: decodeURIComponent(m[2]),
    page: Number(u.searchParams.get("page") ?? 1),
    per_page: Number(u.searchParams.get("per_page") ?? 100),
  });
};
export class GithubClient {
  private readonly run: NonNullable<ClientOptions["run"]>;
  constructor(options: ClientOptions = {}) {
    this.run = options.run ?? runGhApi;
  }
  async preflight(owner: string, repo: string): Promise<PublicRepository> {
    const response = await this.run(
      buildEndpoint(ENDPOINTS.repository, { owner, repo }),
    );
    if (response.status !== 200) throw new GhApiError("protocol");
    const parsed = repositorySchema.safeParse(response.body);
    if (
      !parsed.success ||
      parsed.data.private ||
      parsed.data.visibility === "private" ||
      parsed.data.html_url !== `https://github.com/${owner}/${repo}`
    )
      throw new GhApiError("protocol");
    return {
      owner,
      repo,
      fullName: parsed.data.full_name,
      defaultBranch: parsed.data.default_branch,
      fork: parsed.data.fork ?? false,
    };
  }
  async paginate<T>(
    contract: typeof ENDPOINTS.releases | typeof ENDPOINTS.searchIssues,
    params: Record<string, string | number>,
    maxItems: number,
    parse: (body: unknown) => T[],
  ): Promise<PageResult<T>> {
    const items: T[] = [];
    let endpoint = buildEndpoint(contract, {
      ...params,
      page: 1,
      per_page: 100,
    });
    let truncated = false;
    while (true) {
      const response = await this.run(endpoint);
      if (response.status === 204 || response.absent) break;
      const page = parse(response.body);
      const remaining = maxItems - items.length;
      items.push(...page.slice(0, Math.max(0, remaining)));
      const next = nextUrl(response.link);
      if (items.length >= maxItems) {
        truncated = Boolean(next || page.length > remaining);
        break;
      }
      if (!next) break;
      endpoint = endpointFromUrl(next, contract);
    }
    return { items, fetched: items.length, truncated };
  }
  async searchIssues(
    owner: string,
    repo: string,
    maxItems: number,
  ): Promise<PageResult<unknown>> {
    let partial = false;
    const result = await this.paginate(
      ENDPOINTS.searchIssues,
      { q: `repo:${owner}/${repo}` },
      maxItems,
      (body) => {
        const parsed = searchSchema.safeParse(body);
        if (!parsed.success) throw new GhApiError("protocol");
        partial ||=
          parsed.data.incomplete_results ||
          parsed.data.total_count > 1000 ||
          parsed.data.total_count > maxItems;
        return parsed.data.items;
      },
    );
    return { ...result, truncated: result.truncated || partial };
  }
}
