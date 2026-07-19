import { z } from "zod";
import type { Report } from "../domain/report.js";

const repositoryResponseSchema = z
  .object({
    full_name: z.string().min(3),
    description: z.string().nullable(),
    html_url: z.string().url(),
    stargazers_count: z.number().int().nonnegative().optional(),
    forks_count: z.number().int().nonnegative().optional(),
    subscribers_count: z.number().int().nonnegative().optional(),
    watchers_count: z.number().int().nonnegative().optional(),
  })
  .strip();

const releaseResponseSchema = z
  .object({
    id: z.union([z.string().min(1), z.number().int().nonnegative()]),
    name: z.string().nullable().optional(),
    tag_name: z.string().optional(),
    html_url: z.string().url(),
    draft: z.boolean(),
    published_at: z.string().nullable().optional(),
    author: z
      .object({ login: z.string().min(1) })
      .nullable()
      .optional(),
  })
  .strip();

const profileFileSchema = z.object({ html_url: z.string().url() }).strip();
const communityProfileSchema = z
  .object({
    files: z
      .object({
        readme: profileFileSchema.nullable().optional(),
        license: profileFileSchema.nullable().optional(),
        contributing: profileFileSchema.nullable().optional(),
        code_of_conduct: profileFileSchema.nullable().optional(),
        issue_template: profileFileSchema.nullable().optional(),
        pull_request_template: profileFileSchema.nullable().optional(),
      })
      .strip(),
  })
  .strip();

export interface RepositoryCollectionInput {
  owner: string;
  repo: string;
  maintainer: string;
  since: string;
  until: string;
  maxItems: number;
  observedAt: string;
  defaultBranch: string;
}

export interface Page<T> {
  items: T[];
  fetched: number;
  truncated: boolean;
}

export type ContentResult =
  | { status: "present"; sourceUrl: string }
  | { status: "absent" }
  | { status: "unavailable" };

export interface RepositoryCollectionDeps {
  getRepository(): Promise<unknown>;
  listReleases(maxItems: number): Promise<Page<unknown>>;
  getCommunityProfile(): Promise<unknown>;
  getContent(path: string): Promise<ContentResult>;
  listContributors(maxItems: number): Promise<Page<unknown>>;
}

export interface ReleaseEvidence {
  id: string;
  type: "release";
  actor: string;
  occurredAt: string;
  url: string;
  title: string;
  attributionRule: string;
}

const communityMap = {
  readme: "readme",
  license: "license",
  contributing: "contributing",
  codeOfConduct: "code_of_conduct",
  issueTemplate: "issue_template",
  pullRequestTemplate: "pull_request_template",
} as const;

const safeRepositoryUrl = (value: string, owner: string, repo: string) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    url.hostname === "github.com" &&
    !url.username &&
    !url.password &&
    !url.port &&
    !url.search &&
    !url.hash &&
    url.pathname.toLowerCase() === `/${owner}/${repo}`.toLowerCase()
  );
};

const safeChildUrl = (value: string, repositoryUrl: string) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  const prefix = `${new URL(repositoryUrl).pathname.toLowerCase()}/`;
  return (
    url.protocol === "https:" &&
    url.hostname === "github.com" &&
    !url.username &&
    !url.password &&
    !url.port &&
    !url.search &&
    !url.hash &&
    url.pathname.toLowerCase().startsWith(prefix) &&
    !/%2e|%2f/i.test(url.pathname) &&
    !url.pathname.split("/").some((part) => part === "." || part === "..")
  );
};

const safeReleaseUrl = (value: string, repositoryUrl: string) => {
  if (!safeChildUrl(value, repositoryUrl)) return false;
  const repositoryPath = new URL(repositoryUrl).pathname
    .split("/")
    .filter(Boolean);
  const path = new URL(value).pathname.split("/").filter(Boolean);
  const remainder = path.slice(repositoryPath.length);
  return (
    (remainder.length === 2 &&
      remainder[0] === "releases" &&
      (remainder[1] === "latest" || /^\d+$/.test(remainder[1]))) ||
    (remainder.length === 3 &&
      remainder[0] === "releases" &&
      remainder[1] === "tag" &&
      remainder[2].length > 0)
  );
};

const limitation = (code: string, resource: string, message: string) => ({
  code,
  resource,
  message,
});

export async function collectRepository(
  input: RepositoryCollectionInput,
  deps: RepositoryCollectionDeps,
) {
  const since = Date.parse(input.since);
  const until = Date.parse(input.until);
  if (!Number.isFinite(since) || !Number.isFinite(until) || since > until)
    throw new Error("invalid collection window");

  const rawRepository = repositoryResponseSchema.parse(
    await deps.getRepository(),
  );
  if (!safeRepositoryUrl(rawRepository.html_url, input.owner, input.repo))
    throw new Error("invalid repository source URL");

  const repository: Report["repository"] = {
    owner: input.owner,
    name: input.repo,
    fullName: rawRepository.full_name,
    description: rawRepository.description,
    sourceUrl: rawRepository.html_url,
    observedAt: input.observedAt,
  };
  const limitations: Report["limitations"] = [];
  let partial = false;

  const releasePage = await deps.listReleases(input.maxItems);
  const releases: ReleaseEvidence[] = [];
  for (const raw of releasePage.items) {
    const parsed = releaseResponseSchema.parse(raw);
    if (parsed.draft || !parsed.published_at) continue;
    const occurred = Date.parse(parsed.published_at);
    if (!Number.isFinite(occurred)) {
      partial = true;
      limitations.push(
        limitation(
          "release_timestamp_unavailable",
          "releases",
          "A published release had an invalid publication timestamp.",
        ),
      );
      continue;
    }
    if (!parsed.author) {
      partial = true;
      limitations.push(
        limitation(
          "release_actor_unavailable",
          "releases",
          "A published release did not expose its author.",
        ),
      );
      continue;
    }
    if (
      occurred < since ||
      occurred > until ||
      parsed.author.login.toLowerCase() !== input.maintainer.toLowerCase()
    )
      continue;
    if (!safeReleaseUrl(parsed.html_url, repository.sourceUrl))
      throw new Error("invalid release source URL");
    releases.push({
      id: String(parsed.id),
      type: "release",
      actor: parsed.author.login,
      occurredAt: new Date(occurred).toISOString(),
      url: parsed.html_url,
      title: parsed.name ?? parsed.tag_name ?? "Untitled release",
      attributionRule: "release.author.login and release.published_at",
    });
  }
  if (releasePage.truncated) {
    partial = true;
    limitations.push(
      limitation(
        "releases_truncated",
        "releases",
        "Release collection reached the configured item limit.",
      ),
    );
  }

  const community: Report["community"] = {};
  try {
    const profile = communityProfileSchema.parse(
      await deps.getCommunityProfile(),
    );
    for (const [reportKey, apiKey] of Object.entries(communityMap)) {
      const file = profile.files[apiKey as keyof typeof profile.files];
      community[reportKey] =
        file && safeChildUrl(file.html_url, repository.sourceUrl)
          ? { status: "present", sourceUrl: file.html_url }
          : { status: "absent" };
    }
  } catch {
    partial = true;
    for (const reportKey of Object.keys(communityMap))
      community[reportKey] = { status: "unavailable" };
    limitations.push(
      limitation(
        "community_profile_unavailable",
        "communityProfile",
        "GitHub community profile metadata was unavailable.",
      ),
    );
  }

  let securityUnavailable = false;
  let securityPresent = false;
  for (const path of [
    "SECURITY.md",
    ".github/SECURITY.md",
    "docs/SECURITY.md",
  ]) {
    let result: ContentResult;
    try {
      result = await deps.getContent(path);
    } catch {
      result = { status: "unavailable" };
    }
    if (result.status === "present") {
      if (!safeChildUrl(result.sourceUrl, repository.sourceUrl))
        throw new Error("invalid security policy source URL");
      community.securityPolicy = {
        status: "present",
        sourceUrl: result.sourceUrl,
      };
      securityPresent = true;
      break;
    }
    if (result.status === "unavailable") securityUnavailable = true;
  }
  if (!securityPresent) {
    if (securityUnavailable) {
      partial = true;
      community.securityPolicy = { status: "unavailable" };
      limitations.push(
        limitation(
          "security_policy_unavailable",
          "securityPolicy",
          "Security policy fallback paths could not all be checked.",
        ),
      );
    } else community.securityPolicy = { status: "absent" };
  }

  let contributorPagination: Page<unknown> | null = null;
  try {
    contributorPagination = await deps.listContributors(input.maxItems);
    if (contributorPagination.truncated) {
      partial = true;
      limitations.push(
        limitation(
          "contributors_truncated",
          "contributors",
          "Contributor collection reached the configured item limit.",
        ),
      );
    }
  } catch {
    partial = true;
    limitations.push(
      limitation(
        "contributors_unavailable",
        "contributors",
        "Visible contributor data was unavailable.",
      ),
    );
  }

  return {
    repository,
    releases,
    community,
    adoption: {
      stars: rawRepository.stargazers_count ?? null,
      forks: rawRepository.forks_count ?? null,
      watchers:
        rawRepository.subscribers_count ?? rawRepository.watchers_count ?? null,
      observedAt: input.observedAt,
    } satisfies Report["adoption"],
    pagination: {
      releases: {
        fetched: releasePage.fetched,
        truncated: releasePage.truncated,
      },
      contributors: contributorPagination
        ? {
            fetched: contributorPagination.fetched,
            truncated: contributorPagination.truncated,
          }
        : { fetched: 0, truncated: false },
    },
    visibleContributors: contributorPagination?.items.length ?? null,
    limitations,
    partial,
  };
}
