import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { aggregateEvidence } from "../src/domain/aggregate.js";
import { renderJson } from "../src/render/json.js";
import { renderMarkdown } from "../src/render/markdown.js";

const report = (partial = false) =>
  aggregateEvidence({
    generatedAt: "2025-01-01T00:00:00.000Z",
    status: partial ? "partial" : "complete",
    query: {
      repository: { owner: "acme", name: "demo", fullName: "acme/demo" },
      maintainer: "Alice",
      since: "2024-01-01T00:00:00.000Z",
      until: "2025-01-01T00:00:00.000Z",
      maxItems: 20,
    },
    repository: {
      owner: "acme",
      name: "demo",
      fullName: "acme/demo",
      description: "<script>alert(1)</script> | # injected\nheading",
      sourceUrl: "https://github.com/acme/demo",
      observedAt: "2025-01-01T00:00:00.000Z",
    },
    activities: {
      releases: [
        {
          id: "1",
          type: "release",
          actor: "Alice",
          occurredAt: "2024-06-01T00:00:00.000Z",
          url: "https://github.com/acme/demo/releases/tag/v1",
          title: "[unsafe](javascript:alert(1)) | <b>v1</b>\n# heading",
          attributionRule: "release author",
        },
      ],
      authoredPullRequests: [],
      mergedPullRequests: [],
      reviews: [],
      openedIssues: [],
      closedIssues: [],
      issueComments: [],
    },
    community: {
      readme: {
        status: "present",
        sourceUrl: "https://github.com/acme/demo/blob/main/README.md",
      },
      securityPolicy: { status: "absent" },
    },
    adoption: {
      stars: 1,
      forks: 0,
      watchers: null,
      contributors: 2,
      observedAt: "2025-01-01T00:00:00.000Z",
    },
    pagination: {
      releases: { fetched: 1, truncated: partial },
      contributors: { fetched: 2, truncated: false },
      authoredPullRequests: { fetched: 0, truncated: false },
      mergedPullRequests: { fetched: 0, truncated: false },
      reviews: { fetched: 0, truncated: false },
      openedIssues: { fetched: 0, truncated: false },
      closedIssues: { fetched: 0, truncated: false },
      issueComments: { fetched: 0, truncated: false },
    },
    limitations: partial
      ? [
          {
            code: "releases_truncated",
            resource: "releases",
            message: "Release pages were capped.",
          },
        ]
      : [],
  } as never);

const goldenReport = (partial = false) =>
  aggregateEvidence({
    generatedAt: "2025-01-01T00:00:00.000Z",
    status: partial ? "partial" : "complete",
    query: {
      repository: { owner: "acme", name: "demo", fullName: "acme/demo" },
      maintainer: "Alice",
      since: "2024-01-01T00:00:00.000Z",
      until: "2025-01-01T00:00:00.000Z",
      maxItems: 20,
    },
    repository: {
      owner: "acme",
      name: "demo",
      fullName: "acme/demo",
      description: null,
      sourceUrl: "https://github.com/acme/demo",
      observedAt: "2025-01-01T00:00:00.000Z",
    },
    activities: {
      releases: [],
      authoredPullRequests: [],
      mergedPullRequests: [],
      reviews: [],
      openedIssues: [],
      closedIssues: [],
      issueComments: [],
    },
    community: {},
    adoption: {
      stars: null,
      forks: null,
      watchers: null,
      contributors: null,
      observedAt: "2025-01-01T00:00:00.000Z",
    },
    pagination: {
      releases: { fetched: 0, truncated: false },
      contributors: { fetched: 0, truncated: false },
      authoredPullRequests: { fetched: 0, truncated: false },
      mergedPullRequests: { fetched: 0, truncated: false },
      reviews: { fetched: 0, truncated: false },
      openedIssues: { fetched: 0, truncated: false },
      closedIssues: { fetched: 0, truncated: false },
      issueComments: { fetched: 0, truncated: partial },
    },
    limitations: partial
      ? [
          {
            code: "issueComments_truncated",
            resource: "issueComments",
            message: "Comments were capped.",
          },
        ]
      : [],
  } as never);

test("renders eight stable safe Markdown sections", () => {
  const output = renderMarkdown(report());
  for (let number = 1; number <= 8; number++)
    assert.match(output, new RegExp(`^## ${number}\\. `, "m"));
  assert.doesNotMatch(output, /<script>|<b>|^# injected|\]\(javascript:/m);
  assert.match(output, /No authored pull requests found/);
  assert.match(output, /Counts below are calculated/);
  assert.match(output, /https:\/\/github\.com\/acme\/demo\/releases\/tag\/v1/);
});

test("renders a prominent partial warning and every limitation", () => {
  const output = renderMarkdown(report(true));
  assert.match(output, /^> \*\*Partial report:/m);
  assert.match(output, /releases\\_truncated/);
  assert.match(output, /Release pages were capped/);
});

test("renders deterministic two-space JSON with a final newline", () => {
  const output = renderJson(report());
  assert.equal(output, renderJson(report()));
  assert.match(output, /\n {2}"schemaVersion": "1\.0"/);
  assert.equal(output.endsWith("\n"), true);
  assert.deepEqual(JSON.parse(output), report());
});

test("matches reviewed complete and partial golden files", () => {
  assert.equal(
    renderMarkdown(goldenReport()),
    readFileSync(resolve("test/golden/report-complete.md"), "utf8"),
  );
  assert.equal(
    renderJson(goldenReport()),
    readFileSync(resolve("test/golden/report-complete.json"), "utf8"),
  );
  assert.equal(
    renderMarkdown(goldenReport(true)),
    readFileSync(resolve("test/golden/report-partial.md"), "utf8"),
  );
});
