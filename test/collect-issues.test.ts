import assert from "node:assert/strict";
import test from "node:test";
import {
  collectIssues,
  type IssueCollectionDeps,
} from "../src/github/collect-issues.js";

const input = {
  owner: "acme",
  repo: "demo",
  maintainer: "Alice",
  since: "2024-01-01T00:00:00Z",
  until: "2024-12-31T23:59:59Z",
  maxItems: 20,
};

const issue = {
  id: 10,
  number: 7,
  title: "Document behavior",
  html_url: "https://github.com/acme/demo/issues/7",
  user: { login: "alice" },
  created_at: "2024-01-01T09:00:00+09:00",
};

const deps = (overrides: Partial<IssueCollectionDeps> = {}) => ({
  searchOpened: async () => ({ items: [issue], fetched: 1, truncated: false }),
  searchClosed: async () => ({ items: [issue], fetched: 1, truncated: false }),
  listComments: async () => ({
    items: [
      {
        id: 88,
        html_url: "https://github.com/acme/demo/issues/7#issuecomment-88",
        issue_url: "https://api.github.com/repos/acme/demo/issues/7",
        user: { login: "ALICE" },
        created_at: "2024-01-01T00:00:00Z",
      },
    ],
    fetched: 1,
    truncated: false,
  }),
  getIssue: async () => ({
    ...issue,
    closed_at: "2024-12-31T23:59:59Z",
    closed_by: { login: "Alice" },
  }),
  ...overrides,
});

test("uses exact issue queries and a one-second comment overlap", async () => {
  const calls: string[] = [];
  const result = await collectIssues(
    input,
    deps({
      searchOpened: async (query, maxItems) => {
        calls.push(query);
        assert.equal(maxItems, 20);
        return { items: [issue], fetched: 1, truncated: false };
      },
      searchClosed: async (query) => {
        calls.push(query);
        return { items: [issue], fetched: 1, truncated: false };
      },
      listComments: async (since) => {
        calls.push(since);
        return {
          items: [
            {
              id: 88,
              html_url: "https://github.com/acme/demo/issues/7#issuecomment-88",
              issue_url: "https://api.github.com/repos/acme/demo/issues/7",
              user: { login: "Alice" },
              created_at: input.since,
            },
          ],
          fetched: 1,
          truncated: false,
        };
      },
    }),
  );
  assert.deepEqual(calls, [
    "repo:acme/demo is:public is:issue author:Alice created:2024-01-01T00:00:00Z..2024-12-31T23:59:59Z",
    "repo:acme/demo is:public is:issue is:closed closed:2024-01-01T00:00:00Z..2024-12-31T23:59:59Z",
    "2023-12-31T23:59:59.000Z",
  ]);
  assert.equal(result.activities.openedIssues.length, 1);
  assert.equal(result.activities.closedIssues.length, 1);
  assert.equal(result.activities.issueComments.length, 1);
});

test("excludes search results and comments whose parent is a pull request", async () => {
  const pull = { ...issue, pull_request: { url: "redacted" } };
  const result = await collectIssues(
    input,
    deps({
      searchOpened: async () => ({
        items: [pull],
        fetched: 1,
        truncated: false,
      }),
      searchClosed: async () => ({
        items: [pull],
        fetched: 1,
        truncated: false,
      }),
      getIssue: async () => ({
        ...pull,
        closed_at: input.until,
        closed_by: { login: "Alice" },
      }),
    }),
  );
  assert.equal(result.activities.openedIssues.length, 0);
  assert.equal(result.activities.closedIssues.length, 0);
  assert.equal(result.activities.issueComments.length, 0);
});

test("locally filters overlap records and deduplicates comments", async () => {
  const before = {
    id: 87,
    html_url: "https://github.com/acme/demo/issues/7#issuecomment-87",
    issue_url: "https://api.github.com/repos/acme/demo/issues/7",
    user: { login: "Alice" },
    created_at: "2023-12-31T23:59:59Z",
  };
  const boundary = {
    ...before,
    id: 88,
    html_url: "https://github.com/acme/demo/issues/7#issuecomment-88",
    created_at: input.since,
  };
  const result = await collectIssues(
    input,
    deps({
      listComments: async () => ({
        items: [before, boundary, boundary],
        fetched: 3,
        truncated: false,
      }),
    }),
  );
  assert.deepEqual(
    result.activities.issueComments.map(({ id }) => id),
    ["88"],
  );
});

test("attributes closure only to closed_by and comments only to their actor", async () => {
  const result = await collectIssues(
    input,
    deps({
      getIssue: async () => ({
        ...issue,
        closed_at: "2024-06-01T00:00:00Z",
        closed_by: { login: "Bob" },
      }),
      listComments: async () => ({
        items: [
          {
            id: 88,
            html_url: "https://github.com/acme/demo/issues/7#issuecomment-88",
            issue_url: "https://api.github.com/repos/acme/demo/issues/7",
            user: { login: "Bob" },
            created_at: "2024-06-01T00:00:00Z",
          },
        ],
        fetched: 1,
        truncated: false,
      }),
    }),
  );
  assert.equal(result.activities.closedIssues.length, 0);
  assert.equal(result.activities.issueComments.length, 0);
});

test("caches parent issues and fails closed on required detail failures", async () => {
  let detailCalls = 0;
  await collectIssues(
    input,
    deps({
      listComments: async () => ({
        items: [
          {
            id: 88,
            html_url: "https://github.com/acme/demo/issues/7#issuecomment-88",
            issue_url: "https://api.github.com/repos/acme/demo/issues/7",
            user: { login: "Alice" },
            created_at: input.since,
          },
        ],
        fetched: 1,
        truncated: false,
      }),
      getIssue: async () => {
        detailCalls++;
        return {
          ...issue,
          closed_at: input.until,
          closed_by: { login: "Alice" },
        };
      },
    }),
  );
  assert.equal(detailCalls, 1);
  await assert.rejects(
    collectIssues(
      input,
      deps({
        getIssue: async () => {
          throw new Error("unavailable");
        },
      }),
    ),
  );
});

test("reports capped issue resources as partial", async () => {
  const result = await collectIssues(
    input,
    deps({
      searchOpened: async () => ({ items: [], fetched: 0, truncated: true }),
      searchClosed: async () => ({ items: [], fetched: 0, truncated: true }),
      listComments: async () => ({ items: [], fetched: 0, truncated: true }),
    }),
  );
  assert.equal(result.partial, true);
  assert.deepEqual(
    result.limitations.map(({ code }) => code),
    [
      "openedIssues_truncated",
      "closedIssues_truncated",
      "issueComments_truncated",
    ],
  );
});
