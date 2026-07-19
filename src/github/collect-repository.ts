import { z } from "zod";
import type { Report } from "../domain/report.js";

const repo = z
  .object({
    full_name: z.string(),
    description: z.string().nullable().optional(),
    html_url: z.string().url(),
    default_branch: z.string().optional(),
    stargazers_count: z.number().int().nonnegative().optional(),
    forks_count: z.number().int().nonnegative().optional(),
    subscribers_count: z.number().int().nonnegative().optional(),
    watchers_count: z.number().int().nonnegative().optional(),
  })
  .passthrough();
const release = z
  .object({
    id: z.union([z.string(), z.number()]),
    name: z.string().optional(),
    html_url: z.string().url(),
    draft: z.boolean(),
    published_at: z.string().nullable().optional(),
    author: z.object({ login: z.string() }).nullable().optional(),
  })
  .passthrough();
type Input = {
  owner: string;
  repo: string;
  maintainer: string;
  since: string;
  until: string;
  maxItems: number;
  observedAt: string;
  defaultBranch: string;
};
type Page<T> = { items: T[]; fetched: number; truncated: boolean };
export interface CollectionDeps {
  getRepository(): Promise<unknown>;
  listReleases(): Promise<Page<unknown>>;
  getCommunityProfile(): Promise<unknown>;
  getContent(path: string): Promise<unknown>;
  listContributors(): Promise<Page<unknown>>;
}
const paths = [
  "README.md",
  "LICENSE",
  "CONTRIBUTING.md",
  "SECURITY.md",
  ".github/SECURITY.md",
  "docs/SECURITY.md",
] as const;
export async function collectRepository(input: Input, deps: CollectionDeps) {
  const limitations: Report["limitations"] = [];
  let partial = false;
  const r = repo.parse(await deps.getRepository());
  const repository = {
    owner: input.owner,
    name: input.repo,
    fullName: r.full_name,
    description: r.description ?? null,
    sourceUrl: `https://github.com/${input.owner}/${input.repo}`,
    observedAt: input.observedAt,
  };
  const releases: Array<{
    id: string;
    type: "release";
    actor: string;
    occurredAt: string;
    url: string;
    title: string;
    attributionRule: string;
  }> = [];
  const page = await deps.listReleases();
  for (const raw of page.items) {
    const x = release.safeParse(raw);
    if (!x.success) {
      limitations.push({
        code: "malformed_release",
        resource: "releases",
        message: "Malformed release",
      });
      partial = true;
      continue;
    }
    const v = x.data;
    const at = v.published_at;
    const ms = at ? Date.parse(at) : NaN;
    const lo = Date.parse(input.since),
      hi = Date.parse(input.until);
    const canonical = `https://github.com/${input.owner}/${input.repo}/releases/${v.id}`;
    if (
      v.draft ||
      !at ||
      !Number.isFinite(ms) ||
      ms < lo ||
      ms > hi ||
      !v.author ||
      v.author.login.toLowerCase() !== input.maintainer.toLowerCase()
    )
      continue;
    releases.push({
      id: String(v.id),
      type: "release",
      actor: v.author.login,
      occurredAt: new Date(ms).toISOString(),
      url: canonical,
      title: v.name ?? "",
      attributionRule: "release.author.login",
    });
  }
  if (page.truncated) {
    partial = true;
    limitations.push({
      code: "releases_truncated",
      resource: "releases",
      message: "Release list truncated",
    });
  }
  const community: Record<string, unknown> = {};
  let profile: Record<string, unknown> = {};
  try {
    const p = await deps.getCommunityProfile();
    profile = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
  } catch {
    partial = true;
    limitations.push({
      code: "community_unavailable",
      resource: "communityProfile",
      message: "Community profile unavailable",
    });
  }
  const files = (
    profile.files && typeof profile.files === "object" ? profile.files : {}
  ) as Record<string, unknown>;
  const map: Record<string, string> = {
    readme: "readme",
    license: "license",
    contributing: "contributing",
    codeOfConduct: "code_of_conduct",
    issueTemplate: "issue_template",
    pullRequestTemplate: "pull_request_template",
  };
  for (const k of [
    "readme",
    "license",
    "contributing",
    "securityPolicy",
    "codeOfConduct",
    "issueTemplate",
    "pullRequestTemplate",
  ]) {
    const f = files[map[k]];
    const u =
      f && typeof f === "object"
        ? ((f as Record<string, unknown>).html_url ??
          (f as Record<string, unknown>).url)
        : undefined;
    community[k] =
      typeof u === "string" && u.startsWith(`${repository.sourceUrl}/`)
        ? { status: "present", sourceUrl: u }
        : { status: "absent" };
  }
  for (const p of paths) {
    try {
      const c = await deps.getContent(p);
      if (
        c &&
        typeof c === "object" &&
        "status" in c &&
        (c as { status?: unknown }).status === "unavailable"
      ) {
        partial = true;
        continue;
      }
      const key = p.includes("SECURITY") ? "securityPolicy" : p;
      if (key in community)
        community[key] = {
          status: "present",
          sourceUrl: `${repository.sourceUrl}/blob/${input.defaultBranch}/${p}`,
        };
    } catch {
      if (
        p === "SECURITY.md" ||
        p === ".github/SECURITY.md" ||
        p === "docs/SECURITY.md"
      )
        continue;
    }
  }
  const contributors = await deps.listContributors();
  const adoption = {
    stars: r.stargazers_count ?? null,
    forks: r.forks_count ?? null,
    watchers: r.subscribers_count ?? r.watchers_count ?? null,
    observedAt: input.observedAt,
  };
  const pagination = {
    releases: { fetched: page.fetched, truncated: page.truncated },
    authoredPullRequests: { fetched: 0, truncated: false },
    mergedPullRequests: { fetched: 0, truncated: false },
    reviews: { fetched: 0, truncated: false },
    openedIssues: { fetched: 0, truncated: false },
    closedIssues: { fetched: 0, truncated: false },
    issueComments: { fetched: 0, truncated: false },
  };
  if (contributors.truncated)
    limitations.push({
      code: "contributors_truncated",
      resource: "contributors",
      message: "Contributor list truncated",
    });
  return {
    repository,
    releases,
    community,
    adoption,
    pagination,
    limitations,
    partial,
  };
}
