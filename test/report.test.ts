import assert from "node:assert/strict";
import test from "node:test";
import { aggregateEvidence, reportSchema } from "../src/domain/aggregate.js";

const base = {
  query: {
    repository: { owner: "acme", name: "repo", fullName: "acme/repo" },
    maintainer: "octocat",
    since: "2026-01-01T00:00:00.000Z",
    until: "2026-01-31T00:00:00.000Z",
    maxItems: 20,
  },
  repository: {
    owner: "acme",
    name: "repo",
    fullName: "acme/repo",
    description: null,
    sourceUrl: "https://github.com/acme/repo",
    observedAt: "2026-01-31T00:00:00.000Z",
  },
  community: {
    readme: {
      status: "present",
      sourceUrl: "https://github.com/acme/repo/blob/main/README.md",
    },
    contributing: { status: "absent" },
    codeOfConduct: { status: "unavailable" },
  },
  adoption: {
    stars: null,
    forks: 3,
    watchers: null,
    observedAt: "2026-01-31T00:00:00.000Z",
  },
  pagination: {
    releases: { fetched: 2, truncated: false },
    authoredPullRequests: { fetched: 2, truncated: false },
    mergedPullRequests: { fetched: 0, truncated: false },
    reviews: { fetched: 0, truncated: false },
    openedIssues: { fetched: 0, truncated: false },
    closedIssues: { fetched: 0, truncated: false },
    issueComments: { fetched: 0, truncated: false },
  },
  limitations: [],
};
const activity = (id: string, type: "release" | "authored_pull_request") => ({
  id,
  type,
  actor: "octocat",
  occurredAt: "2026-01-02T00:00:00.000Z",
  url: `https://github.com/acme/repo/${type}/${id}`,
  title: "same",
  attributionRule: "author",
});

test("aggregates a strict versioned report and computes counts", () => {
  const report = aggregateEvidence({
    ...base,
    status: "complete",
    activities: {
      releases: [activity("1", "release")],
      authoredPullRequests: [
        activity("1", "authored_pull_request"),
        activity("1", "authored_pull_request"),
        activity("2", "authored_pull_request"),
      ],
      mergedPullRequests: [],
      reviews: [],
      openedIssues: [],
      closedIssues: [],
      issueComments: [],
    },
    summary: { releases: 999 },
  } as never);
  assert.equal(report.schemaVersion, "1.0");
  assert.deepEqual(report.summary, {
    releases: 1,
    authoredPullRequests: 2,
    mergedPullRequests: 0,
    reviews: 0,
    openedIssues: 0,
    closedIssues: 0,
    issueComments: 0,
    total: 3,
  });
  assert.equal((report.activities.authoredPullRequests as unknown[]).length, 2);
  assert.match(report.generatedAt, /Z$/);
});

test("rejects invalid URLs, timestamps, statuses and negative counts", () => {
  assert.throws(
    () =>
      reportSchema.parse({
        schemaVersion: "1.0",
        generatedAt: "2026-01-01T00:00:00",
        status: "complete",
      }),
    /./,
  );
  assert.throws(
    () =>
      aggregateEvidence({
        ...base,
        status: "complete",
        activities: {
          releases: [],
          authoredPullRequests: [],
          mergedPullRequests: [],
          reviews: [],
          openedIssues: [],
          closedIssues: [],
          issueComments: [],
        },
        repository: {
          ...base.repository,
          sourceUrl: "https://evil.test/acme/repo",
        },
      } as never),
    /./,
  );
  assert.throws(
    () =>
      aggregateEvidence({
        ...base,
        status: "complete",
        activities: {
          releases: [],
          authoredPullRequests: [],
          mergedPullRequests: [],
          reviews: [],
          openedIssues: [],
          closedIssues: [],
          issueComments: [],
        },
        pagination: {
          ...base.pagination,
          releases: { fetched: -1, truncated: false },
        },
      } as never),
    /./,
  );
});

test("rejects github URL traversal and authority variants", () => {
  for (const sourceUrl of [
    "https://github.com.evil.test/acme/repo",
    "https://github.com/acme/repo?x=1",
    "https://user:pass@github.com/acme/repo",
    "https://github.com:443/acme/repo",
    "https://github.com/acme/repo/",
    "https://github.com/acme//repo",
    "https://github.com/acme/./repo",
    "https://github.com/acme/%2e%2e/repo",
  ])
    assert.throws(() =>
      reportSchema.parse({
        ...base,
        status: "complete",
        generatedAt: "2026-01-01T00:00:00Z",
        activities: {
          releases: [],
          authoredPullRequests: [],
          mergedPullRequests: [],
          reviews: [],
          openedIssues: [],
          closedIssues: [],
          issueComments: [],
        },
        repository: { ...base.repository, sourceUrl },
      } as never),
    );
});

test("rejects impossible UTC calendar dates", () => {
  assert.throws(() =>
    reportSchema.parse({
      ...base,
      status: "complete",
      generatedAt: "2026-02-30T00:00:00Z",
      activities: {
        releases: [],
        authoredPullRequests: [],
        mergedPullRequests: [],
        reviews: [],
        openedIssues: [],
        closedIssues: [],
        issueComments: [],
      },
    } as never),
  );
});

test("aggregation is deterministic for reversed input and conflicting duplicates", () => {
  const a = activity("1", "release");
  const b = { ...a, title: "zzz" };
  const mk = (xs: unknown[]) =>
    aggregateEvidence({
      ...base,
      generatedAt: "2026-01-03T00:00:00Z",
      status: "complete",
      activities: {
        releases: xs,
        authoredPullRequests: [],
        mergedPullRequests: [],
        reviews: [],
        openedIssues: [],
        closedIssues: [],
        issueComments: [],
      },
    } as never);
  assert.deepEqual(mk([a, b]), mk([b, a]));
});
