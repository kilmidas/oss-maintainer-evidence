import assert from "node:assert/strict";
import test from "node:test";
import {
  type CollectionServices,
  collectEvidence,
} from "../src/app/collect.js";
import { RequiredCollectionError } from "../src/errors.js";

const input = {
  repository: { owner: "acme", name: "demo", fullName: "acme/demo" },
  maintainer: "Alice",
  since: "2024-01-01T00:00:00.000Z",
  until: "2024-12-31T23:59:59.000Z",
  format: "json" as const,
  maxItems: 20,
};

const activity = {
  id: "1",
  actor: "Alice",
  occurredAt: "2024-06-01T00:00:00.000Z",
  url: "https://github.com/acme/demo/releases/tag/v1",
  title: "v1",
  attributionRule: "author",
};

const services = (
  overrides: Partial<CollectionServices> = {},
): CollectionServices => ({
  preflight: async () => ({ fullName: "acme/demo", defaultBranch: "main" }),
  collectRepository: async () => ({
    repository: {
      owner: "acme",
      name: "demo",
      fullName: "acme/demo",
      description: null,
      sourceUrl: "https://github.com/acme/demo",
      observedAt: input.until,
    },
    releases: [{ ...activity, type: "release" }],
    community: { readme: { status: "absent" } },
    adoption: {
      stars: 1,
      forks: 0,
      watchers: null,
      contributors: 1,
      observedAt: input.until,
    },
    pagination: {
      releases: { fetched: 1, truncated: false },
      contributors: { fetched: 1, truncated: false },
    },
    limitations: [],
    partial: false,
  }),
  collectPulls: async () => ({
    activities: {
      authoredPullRequests: [],
      mergedPullRequests: [],
      reviews: [],
    },
    pagination: {
      authoredPullRequests: { fetched: 0, truncated: false },
      mergedPullRequests: { fetched: 0, truncated: false },
      reviews: { fetched: 0, truncated: false },
    },
    limitations: [],
    partial: false,
  }),
  collectIssues: async () => ({
    activities: { openedIssues: [], closedIssues: [], issueComments: [] },
    pagination: {
      openedIssues: { fetched: 0, truncated: false },
      closedIssues: { fetched: 0, truncated: false },
      issueComments: { fetched: 0, truncated: false },
    },
    limitations: [],
    partial: false,
  }),
  ...overrides,
});

test("runs preflight first and assembles a validated report", async () => {
  let ready = false;
  const result = await collectEvidence(
    input,
    services({
      preflight: async () => {
        ready = true;
        return { fullName: "acme/demo", defaultBranch: "main" };
      },
      collectRepository: async (value) => {
        assert.equal(ready, true);
        assert.equal(value.defaultBranch, "main");
        return services().collectRepository(value);
      },
      collectPulls: async (value) => {
        assert.equal(ready, true);
        return services().collectPulls(value);
      },
      collectIssues: async (value) => {
        assert.equal(ready, true);
        return services().collectIssues(value);
      },
    }),
  );
  assert.equal(result.status, "complete");
  assert.equal(result.summary.releases, 1);
  assert.equal(result.summary.total, 1);
  assert.equal(result.generatedAt, input.until);
});

test("keeps output deterministic regardless of collector completion order", async () => {
  const delayed = (milliseconds: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
  const first = await collectEvidence(
    input,
    services({
      collectRepository: async (value) => {
        await delayed(5);
        return services().collectRepository(value);
      },
      collectPulls: async (value) => {
        await delayed(1);
        return services().collectPulls(value);
      },
    }),
  );
  const second = await collectEvidence(input, services());
  assert.deepEqual(first, second);
});

test("converts optional gaps and truncation to a partial report", async () => {
  const result = await collectEvidence(
    input,
    services({
      collectIssues: async () => ({
        activities: {
          openedIssues: [],
          closedIssues: [],
          issueComments: [],
        },
        pagination: {
          openedIssues: { fetched: 0, truncated: false },
          closedIssues: { fetched: 0, truncated: false },
          issueComments: { fetched: 20, truncated: true },
        },
        limitations: [
          {
            code: "issueComments_truncated",
            resource: "issueComments",
            message: "Comments were capped.",
          },
        ],
        partial: true,
      }),
    }),
  );
  assert.equal(result.status, "partial");
  assert.equal(
    (
      result.pagination as unknown as Record<
        string,
        { fetched: number; truncated: boolean }
      >
    ).issueComments.truncated,
    true,
  );
  assert.equal(result.limitations[0].code, "issueComments_truncated");
});

test("fails closed with no report on required collection or validation errors", async () => {
  await assert.rejects(
    collectEvidence(
      input,
      services({
        collectPulls: async () => {
          throw new Error("synthetic secret should not escape");
        },
      }),
    ),
    (error: unknown) =>
      error instanceof RequiredCollectionError &&
      !error.message.includes("synthetic secret"),
  );
  await assert.rejects(
    collectEvidence(
      input,
      services({
        collectRepository: async (value) => ({
          ...(await services().collectRepository(value)),
          repository: {
            ...(await services().collectRepository(value)).repository,
            sourceUrl: "https://evil.example/repo",
          },
        }),
      }),
    ),
    RequiredCollectionError,
  );
});
