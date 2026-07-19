import assert from "node:assert/strict";
import test from "node:test";
import {
  collectRepository,
  type RepositoryCollectionDeps,
} from "../src/github/collect-repository.js";

const input = {
  owner: "acme",
  repo: "demo",
  maintainer: "maintainer",
  since: "2024-01-01T00:00:00Z",
  until: "2024-12-31T23:59:59Z",
  maxItems: 10,
  observedAt: "2025-01-01T00:00:00Z",
  defaultBranch: "main",
};

const repository = {
  full_name: "acme/demo",
  description: null,
  html_url: "https://github.com/acme/demo",
  stargazers_count: 2,
  forks_count: 1,
  subscribers_count: 4,
};

const published = {
  id: 1,
  name: "v1",
  html_url: "https://github.com/acme/demo/releases/tag/v1",
  draft: false,
  published_at: "2024-01-01T09:00:00+09:00",
  author: { login: "Maintainer" },
};

const deps = (overrides: Partial<RepositoryCollectionDeps> = {}) => ({
  getRepository: async () => repository,
  listReleases: async () => ({
    items: [published],
    fetched: 1,
    truncated: false,
  }),
  getCommunityProfile: async () => ({
    files: {
      readme: {
        html_url: "https://github.com/acme/demo/blob/main/README.md",
      },
      license: null,
      contributing: null,
      code_of_conduct: null,
      issue_template: null,
      pull_request_template: null,
    },
  }),
  getContent: async () => ({ status: "absent" }) as const,
  listContributors: async () => ({
    items: [{ login: "Maintainer" }],
    fetched: 1,
    truncated: false,
  }),
  ...overrides,
});

test("collects inclusive published releases and observed adoption", async () => {
  let releaseLimit = 0;
  let contributorLimit = 0;
  const result = await collectRepository(
    input,
    deps({
      listReleases: async (maxItems) => {
        releaseLimit = maxItems;
        return { items: [published], fetched: 1, truncated: false };
      },
      listContributors: async (maxItems) => {
        contributorLimit = maxItems;
        return { items: [{}], fetched: 1, truncated: false };
      },
    }),
  );
  assert.equal(result.releases.length, 1);
  assert.equal(result.releases[0].occurredAt, "2024-01-01T00:00:00.000Z");
  assert.equal(result.releases[0].actor, "Maintainer");
  assert.deepEqual(result.adoption, {
    stars: 2,
    forks: 1,
    watchers: 4,
    observedAt: input.observedAt,
  });
  assert.equal(result.visibleContributors, 1);
  assert.equal(releaseLimit, 10);
  assert.equal(contributorLimit, 10);
});

test("excludes drafts, unpublished releases, other actors and out-of-window events", async () => {
  const variants = [
    { ...published, id: 2, draft: true },
    { ...published, id: 3, published_at: null },
    { ...published, id: 4, author: { login: "someone-else" } },
    { ...published, id: 5, published_at: "2023-12-31T23:59:59Z" },
  ];
  const result = await collectRepository(
    input,
    deps({
      listReleases: async () => ({
        items: variants,
        fetched: variants.length,
        truncated: false,
      }),
    }),
  );
  assert.equal(result.releases.length, 0);
});

test("rejects malformed or non-canonical required repository and release data", async () => {
  await assert.rejects(
    collectRepository(
      input,
      deps({
        getRepository: async () => ({
          ...repository,
          html_url: "https://evil.example/demo",
        }),
      }),
    ),
  );
  await assert.rejects(
    collectRepository(
      input,
      deps({
        listReleases: async () => ({
          items: [{ ...published, html_url: "https://evil.example/release" }],
          fetched: 1,
          truncated: false,
        }),
      }),
    ),
  );
});

test("uses profile tri-state and first present security fallback", async () => {
  const checked: string[] = [];
  const result = await collectRepository(
    input,
    deps({
      getContent: async (path) => {
        checked.push(path);
        return path === ".github/SECURITY.md"
          ? {
              status: "present",
              sourceUrl:
                "https://github.com/acme/demo/blob/main/.github/SECURITY.md",
            }
          : { status: "absent" };
      },
    }),
  );
  assert.equal(result.community.readme.status, "present");
  assert.equal(result.community.license.status, "absent");
  assert.equal(result.community.securityPolicy.status, "present");
  assert.deepEqual(checked, ["SECURITY.md", ".github/SECURITY.md"]);
});

test("marks optional profile, security and contributors unavailable", async () => {
  const result = await collectRepository(
    input,
    deps({
      getCommunityProfile: async () => {
        throw new Error("unavailable");
      },
      getContent: async () => ({ status: "unavailable" }),
      listContributors: async () => {
        throw new Error("unavailable");
      },
    }),
  );
  assert.equal(result.partial, true);
  assert.equal(result.community.readme.status, "unavailable");
  assert.equal(result.community.securityPolicy.status, "unavailable");
  assert.equal(result.visibleContributors, null);
  assert.deepEqual(
    result.limitations.map(({ code }) => code),
    [
      "community_profile_unavailable",
      "security_policy_unavailable",
      "contributors_unavailable",
    ],
  );
});

test("surfaces release and contributor truncation without hidden over-count", async () => {
  const result = await collectRepository(
    input,
    deps({
      listReleases: async () => ({
        items: [published],
        fetched: 1,
        truncated: true,
      }),
      listContributors: async () => ({
        items: [{}, {}],
        fetched: 2,
        truncated: true,
      }),
    }),
  );
  assert.equal(result.partial, true);
  assert.equal(result.pagination.releases.truncated, true);
  assert.equal(result.pagination.contributors.truncated, true);
  assert.equal(result.visibleContributors, 2);
  assert.deepEqual(
    result.limitations.map(({ code }) => code),
    ["releases_truncated", "contributors_truncated"],
  );
});

test("preserves unknown adoption values as null", async () => {
  const result = await collectRepository(
    input,
    deps({
      getRepository: async () => ({
        full_name: "acme/demo",
        description: null,
        html_url: "https://github.com/acme/demo",
      }),
    }),
  );
  assert.equal(result.adoption.stars, null);
  assert.equal(result.adoption.forks, null);
  assert.equal(result.adoption.watchers, null);
});
