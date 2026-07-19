import assert from "node:assert/strict";
import test from "node:test";

import {
  type FetchLike,
  verifySignedOutGithubTarget,
} from "../src/http/signed-out-github.js";

function response(
  status: number,
  location?: string,
  onCancel: () => void = () => undefined,
): Response {
  return {
    status,
    headers: new Headers(location ? { location } : {}),
    body: { cancel: async () => onCancel() },
  } as unknown as Response;
}

test("signed-out request uses only explicit non-secret policy and cancels body", async () => {
  let cancelled = false;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher: FetchLike = async (input, init) => {
    calls.push({ url: String(input), init });
    return response(200, undefined, () => {
      cancelled = true;
    });
  };

  const result = await verifySignedOutGithubTarget(
    "https://github.com/acme/demo#pullrequestreview-7",
    { fetcher },
  );

  assert.deepEqual(result, {
    status: "pass",
    httpStatus: 200,
    finalUrl: "https://github.com/acme/demo",
  });
  assert.equal(cancelled, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "https://github.com/acme/demo");
  assert.deepEqual(calls[0]?.init?.headers, {
    Accept: "text/html,application/xhtml+xml",
    "User-Agent": "oss-evidence signed-out-link-verifier",
  });
  assert.equal(calls[0]?.init?.method, "GET");
  assert.equal(calls[0]?.init?.redirect, "manual");
  assert.equal(calls[0]?.init?.credentials, "omit");
});

test("signed-out request follows bounded same-host relative redirects", async () => {
  const calls: string[] = [];
  const fetcher: FetchLike = async (input) => {
    const url = String(input);
    calls.push(url);
    return calls.length === 1 ? response(301, "/acme/renamed") : response(204);
  };

  const result = await verifySignedOutGithubTarget(
    "https://github.com/acme/demo",
    { fetcher },
  );

  assert.deepEqual(calls, [
    "https://github.com/acme/demo",
    "https://github.com/acme/renamed",
  ]);
  assert.deepEqual(result, {
    status: "pass",
    httpStatus: 204,
    finalUrl: "https://github.com/acme/renamed",
  });
});

test("signed-out request rejects unsafe redirect behavior", async () => {
  const cases: Array<{
    label: string;
    fetcher: FetchLike;
    reason: string;
    maxRedirects?: number;
  }> = [
    {
      label: "missing location",
      fetcher: async () => response(302),
      reason: "redirect_missing",
    },
    {
      label: "cross-host location",
      fetcher: async () => response(302, "https://example.test/acme/demo"),
      reason: "redirect_invalid",
    },
    {
      label: "query location",
      fetcher: async () => response(302, "https://github.com/acme/demo?x=1"),
      reason: "redirect_invalid",
    },
    {
      label: "loop",
      fetcher: async () => response(302, "/acme/demo"),
      reason: "redirect_loop",
    },
    {
      label: "limit",
      fetcher: async (input) => response(302, `${String(input)}/next`),
      reason: "redirect_limit",
      maxRedirects: 1,
    },
  ];

  for (const { label, fetcher, reason, maxRedirects } of cases) {
    const result = await verifySignedOutGithubTarget(
      "https://github.com/acme/demo",
      { fetcher, ...(maxRedirects ? { maxRedirects } : {}) },
    );
    assert.deepEqual(result, { status: "fail", reason }, label);
  }
});

test("signed-out request reports non-success HTTP status without a body", async () => {
  const result = await verifySignedOutGithubTarget(
    "https://github.com/acme/demo/issues/7",
    { fetcher: async () => response(404) },
  );

  assert.deepEqual(result, {
    status: "fail",
    reason: "http_404",
    httpStatus: 404,
  });
});

test("signed-out request maps timeout and network errors to fixed safe reasons", async () => {
  const timeoutFetcher: FetchLike = (_input, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new Error("ghp_syntheticcredentialthatmustneverappear"));
      });
    });
  const timeout = await verifySignedOutGithubTarget(
    "https://github.com/acme/demo",
    { fetcher: timeoutFetcher, timeoutMs: 5 },
  );
  assert.deepEqual(timeout, { status: "fail", reason: "timeout" });

  const network = await verifySignedOutGithubTarget(
    "https://github.com/acme/demo",
    {
      fetcher: async () => {
        throw new Error("ghp_syntheticcredentialthatmustneverappear");
      },
    },
  );
  assert.deepEqual(network, { status: "fail", reason: "network" });
  assert.equal(JSON.stringify(network).includes("syntheticcredential"), false);
});

test("signed-out request rejects a noncanonical initial target before fetch", async () => {
  let called = false;
  const result = await verifySignedOutGithubTarget(
    "https://example.test/acme/demo",
    {
      fetcher: async () => {
        called = true;
        return response(200);
      },
    },
  );

  assert.deepEqual(result, { status: "fail", reason: "invalid_target" });
  assert.equal(called, false);
});
