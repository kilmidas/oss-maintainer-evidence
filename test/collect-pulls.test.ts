import assert from "node:assert/strict";
import test from "node:test";
import {
  collectPulls,
  type PullCollectionDeps,
} from "../src/github/collect-pulls.js";

const input = {
  owner: "acme",
  repo: "demo",
  maintainer: "Alice",
  since: "2024-01-01T00:00:00Z",
  until: "2024-12-31T23:59:59Z",
  maxItems: 25,
};

const candidate = {
  id: 10,
  number: 7,
  title: "Improve docs",
  html_url: "https://github.com/acme/demo/pull/7",
  user: { login: "alice" },
  created_at: "2024-01-01T09:00:00+09:00",
};

const deps = (overrides: Partial<PullCollectionDeps> = {}) => ({
  searchAuthored: async () => ({
    items: [candidate, candidate],
    fetched: 2,
    truncated: false,
  }),
  searchMerged: async () => ({
    items: [candidate, candidate],
    fetched: 2,
    truncated: false,
  }),
  searchReviewed: async () => ({
    items: [candidate, candidate],
    fetched: 2,
    truncated: false,
  }),
  getPull: async () => ({
    id: 10,
    number: 7,
    title: "Improve docs",
    html_url: "https://github.com/acme/demo/pull/7",
    merged_at: "2024-12-31T23:59:59Z",
    merged_by: { login: "ALICE" },
  }),
  listReviews: async () => ({
    items: [
      {
        id: 99,
        user: { login: "alice" },
        submitted_at: "2024-06-01T00:00:00Z",
        html_url: "https://github.com/acme/demo/pull/7#pullrequestreview-99",
      },
      {
        id: 99,
        user: { login: "alice" },
        submitted_at: "2024-06-01T00:00:00Z",
        html_url: "https://github.com/acme/demo/pull/7#pullrequestreview-99",
      },
    ],
    fetched: 2,
    truncated: false,
  }),
  ...overrides,
});

test("uses exact bounded queries and documented attribution rules", async () => {
  const queries: string[] = [];
  const result = await collectPulls(
    input,
    deps({
      searchAuthored: async (query, maxItems) => {
        queries.push(query);
        assert.equal(maxItems, 25);
        return { items: [candidate], fetched: 1, truncated: false };
      },
      searchMerged: async (query) => {
        queries.push(query);
        return { items: [candidate], fetched: 1, truncated: false };
      },
      searchReviewed: async (query) => {
        queries.push(query);
        return { items: [candidate], fetched: 1, truncated: false };
      },
    }),
  );
  assert.deepEqual(queries, [
    "repo:acme/demo is:public is:pr author:Alice created:2024-01-01T00:00:00Z..2024-12-31T23:59:59Z",
    "repo:acme/demo is:public is:pr is:merged merged:2024-01-01T00:00:00Z..2024-12-31T23:59:59Z",
    "repo:acme/demo is:public is:pr reviewed-by:Alice updated:2024-01-01T00:00:00Z..2024-12-31T23:59:59Z",
  ]);
  assert.equal(result.activities.authoredPullRequests.length, 1);
  assert.equal(result.activities.mergedPullRequests.length, 1);
  assert.equal(result.activities.reviews.length, 1);
});

test("deduplicates candidates and submitted reviews by stable identity", async () => {
  let details = 0;
  let reviewLists = 0;
  const result = await collectPulls(
    input,
    deps({
      getPull: async () => {
        details++;
        return {
          id: 10,
          number: 7,
          title: "Improve docs",
          html_url: "https://github.com/acme/demo/pull/7",
          merged_at: "2024-12-31T23:59:59Z",
          merged_by: { login: "alice" },
        };
      },
      listReviews: async () => {
        reviewLists++;
        return {
          items: [
            {
              id: 99,
              user: { login: "Alice" },
              submitted_at: "2024-06-01T00:00:00Z",
              html_url:
                "https://github.com/acme/demo/pull/7#pullrequestreview-99",
            },
            {
              id: 99,
              user: { login: "Alice" },
              submitted_at: "2024-06-01T00:00:00Z",
              html_url:
                "https://github.com/acme/demo/pull/7#pullrequestreview-99",
            },
          ],
          fetched: 2,
          truncated: false,
        };
      },
    }),
  );
  assert.equal(details, 1);
  assert.equal(reviewLists, 1);
  assert.equal(result.activities.authoredPullRequests.length, 1);
  assert.equal(result.activities.reviews.length, 1);
});

test("does not attribute merged work to a different actor", async () => {
  const result = await collectPulls(
    input,
    deps({
      getPull: async () => ({
        id: 10,
        number: 7,
        title: "Improve docs",
        html_url: "https://github.com/acme/demo/pull/7",
        merged_at: "2024-06-01T00:00:00Z",
        merged_by: { login: "Bob" },
      }),
    }),
  );
  assert.equal(result.activities.mergedPullRequests.length, 0);
});

test("excludes null actors and reviews without submitted_at", async () => {
  const result = await collectPulls(
    input,
    deps({
      searchAuthored: async () => ({
        items: [{ ...candidate, user: null }],
        fetched: 1,
        truncated: false,
      }),
      getPull: async () => ({
        id: 10,
        number: 7,
        title: "Improve docs",
        html_url: "https://github.com/acme/demo/pull/7",
        merged_at: "2024-06-01T00:00:00Z",
        merged_by: null,
      }),
      listReviews: async () => ({
        items: [
          {
            id: 99,
            user: { login: "Alice" },
            submitted_at: null,
            html_url: "https://github.com/acme/demo/pull/7",
          },
        ],
        fetched: 1,
        truncated: false,
      }),
    }),
  );
  assert.equal(result.activities.authoredPullRequests.length, 0);
  assert.equal(result.activities.mergedPullRequests.length, 0);
  assert.equal(result.activities.reviews.length, 0);
});

test("fails closed when required detail or review-list requests fail", async () => {
  await assert.rejects(
    collectPulls(
      input,
      deps({
        getPull: async () => {
          throw new Error("detail unavailable");
        },
      }),
    ),
  );
  await assert.rejects(
    collectPulls(
      input,
      deps({
        listReviews: async () => {
          throw new Error("reviews unavailable");
        },
      }),
    ),
  );
});

test("surfaces every capped search and review page as partial", async () => {
  const result = await collectPulls(
    input,
    deps({
      searchAuthored: async () => ({ items: [], fetched: 0, truncated: true }),
      searchMerged: async () => ({ items: [], fetched: 0, truncated: true }),
      searchReviewed: async () => ({
        items: [candidate],
        fetched: 1,
        truncated: true,
      }),
      listReviews: async () => ({ items: [], fetched: 0, truncated: true }),
    }),
  );
  assert.equal(result.partial, true);
  assert.deepEqual(
    result.limitations.map(({ code }) => code),
    [
      "authoredPullRequests_truncated",
      "mergedPullRequests_truncated",
      "reviews_truncated",
    ],
  );
});
