import { GhApiError } from "../process/gh-runner.js";
import type { BuiltEndpoint, EndpointContract } from "./contracts.js";
import { buildEndpoint, ENDPOINTS } from "./endpoints.js";
import { runPublicGitHubApi } from "./public-api-runner.js";
import { repositorySchema, searchSchema } from "./schemas.js";

type GhResponse = Awaited<ReturnType<typeof runPublicGitHubApi>>;
export interface ClientOptions {
  run?: (endpoint: BuiltEndpoint) => Promise<GhResponse>;
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
    .map((value) => value.trim())
    .find((value) => /;\s*rel="?next"?/i.test(value))
    ?.match(/<([^>]+)>/)?.[1];

const protocolError = () => new GhApiError("protocol");

const endpointFromUrl = (
  value: string,
  contract: EndpointContract,
  expected: Record<string, string | number>,
): BuiltEndpoint => {
  if (/^https:\/\/[^/]*:\d+(?:\/|$)/i.test(value)) throw protocolError();
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw protocolError();
  }
  if (
    url.protocol !== "https:" ||
    !["api.github.com", "github.com"].includes(url.hostname) ||
    url.port ||
    url.username ||
    url.password ||
    url.hash ||
    contract.pagination !== "page"
  )
    throw protocolError();
  const allowed = new Set(contract.queryKeys);
  for (const key of url.searchParams.keys())
    if (!allowed.has(key) || url.searchParams.getAll(key).length !== 1)
      throw protocolError();
  const pageText = url.searchParams.get("page");
  if (pageText === null || !/^[1-9]\d*$/.test(pageText)) throw protocolError();
  const page = Number(pageText);
  if (!Number.isSafeInteger(page) || page < 2) throw protocolError();
  if (url.searchParams.get("per_page") !== "100") throw protocolError();
  for (const key of contract.queryKeys) {
    if (key === "page" || key === "per_page") continue;
    const actual = url.searchParams.get(key);
    const wanted = expected[key];
    if (
      (wanted === undefined && actual !== null) ||
      (wanted !== undefined && actual !== String(wanted))
    )
      throw protocolError();
  }
  let first: BuiltEndpoint;
  try {
    first = buildEndpoint(contract, { ...expected, page: 1, per_page: 100 });
  } catch {
    throw protocolError();
  }
  if (url.pathname !== first.path.split("?")[0]) throw protocolError();
  try {
    return buildEndpoint(contract, { ...expected, page, per_page: 100 });
  } catch {
    throw protocolError();
  }
};

export class GithubClient {
  private readonly run: NonNullable<ClientOptions["run"]>;
  constructor(options: ClientOptions = {}) {
    this.run = options.run ?? runPublicGitHubApi;
  }

  async request(
    contract: EndpointContract,
    params: Record<string, string | number>,
  ): Promise<GhResponse> {
    return this.run(buildEndpoint(contract, params));
  }

  async preflight(owner: string, repo: string): Promise<PublicRepository> {
    const response = await this.request(ENDPOINTS.repository, { owner, repo });
    if (response.status !== 200) throw protocolError();
    const parsed = repositorySchema.safeParse(response.body);
    if (
      !parsed.success ||
      parsed.data.private ||
      parsed.data.visibility !== "public" ||
      parsed.data.full_name.toLowerCase() !==
        `${owner}/${repo}`.toLowerCase() ||
      parsed.data.html_url.toLowerCase() !==
        `https://github.com/${owner}/${repo}`.toLowerCase()
    )
      throw protocolError();
    return {
      owner,
      repo,
      fullName: parsed.data.full_name,
      defaultBranch: parsed.data.default_branch,
      fork: parsed.data.fork ?? false,
    };
  }

  async paginate<T>(
    contract: EndpointContract,
    params: Record<string, string | number>,
    maxItems: number,
    parse: (body: unknown) => T[],
  ): Promise<PageResult<T>> {
    if (contract.pagination !== "page") throw protocolError();
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
      const nextEndpoint = next
        ? endpointFromUrl(next, contract, params)
        : undefined;
      if (items.length >= maxItems) {
        truncated = Boolean(next || page.length > remaining);
        break;
      }
      if (!nextEndpoint) break;
      endpoint = nextEndpoint;
    }
    return { items, fetched: items.length, truncated };
  }

  async search(
    query: string,
    maxItems: number,
    options: { sort?: string; order?: string } = {},
  ): Promise<PageResult<unknown>> {
    let partial = false;
    const result = await this.paginate(
      ENDPOINTS.searchIssues,
      { q: query, ...options },
      maxItems,
      (body) => {
        const parsed = searchSchema.safeParse(body);
        if (!parsed.success) throw protocolError();
        partial ||=
          parsed.data.incomplete_results ||
          parsed.data.total_count > 1000 ||
          parsed.data.total_count > maxItems;
        return parsed.data.items;
      },
    );
    return { ...result, truncated: result.truncated || partial };
  }

  async searchIssues(
    owner: string,
    repo: string,
    maxItems: number,
  ): Promise<PageResult<unknown>> {
    return this.search(`repo:${owner}/${repo}`, maxItems);
  }
}
