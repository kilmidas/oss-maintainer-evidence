import assert from "node:assert/strict";
import test from "node:test";

import { buildEndpoint, ENDPOINTS } from "../src/github/endpoints.js";
import {
  runPublicGitHubApi,
  runSignedOutGitHubApi,
} from "../src/github/public-api-runner.js";
import { GhApiError } from "../src/process/gh-runner.js";

test("signed-out fallback sends one bounded GET without credentials", async () => {
  const calls: Array<{ input: string; init?: RequestInit }> = [];
  const endpoint = buildEndpoint(ENDPOINTS.issue, {
    owner: "octo",
    repo: "hello",
    number: 7,
  });

  const result = await runSignedOutGitHubApi(endpoint, {
    fetcher: async (input, init) => {
      calls.push({ input: String(input), init });
      return new Response('{"number":7}', {
        status: 200,
        headers: {
          "content-type": "application/json",
          link: '<https://api.github.com/repos/octo/hello/issues?page=2&per_page=100>; rel="next"',
        },
      });
    },
  });

  assert.deepEqual(result, {
    status: 200,
    headers: {},
    body: { number: 7 },
    link: '<https://api.github.com/repos/octo/hello/issues?page=2&per_page=100>; rel="next"',
  });
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0]?.input,
    "https://api.github.com/repos/octo/hello/issues/7",
  );
  assert.equal(calls[0]?.init?.method, "GET");
  assert.equal(calls[0]?.init?.redirect, "manual");
  assert.equal(calls[0]?.init?.credentials, "omit");
  assert.deepEqual(calls[0]?.init?.headers, {
    Accept: "application/vnd.github+json",
    "User-Agent": "oss-evidence signed-out-api-fallback",
    "X-GitHub-Api-Version": "2026-03-10",
  });
  assert.equal(
    Object.keys(calls[0]?.init?.headers ?? {}).some(
      (key) => key.toLowerCase() === "authorization",
    ),
    false,
  );
});

test("signed-out fallback preserves expected absence semantics", async () => {
  const result = await runSignedOutGitHubApi(
    buildEndpoint(ENDPOINTS.contents, {
      owner: "octo",
      repo: "hello",
      path: "SECURITY.md",
    }),
    { fetcher: async () => new Response("{}", { status: 404 }) },
  );

  assert.deepEqual(result, {
    status: 404,
    headers: {},
    body: undefined,
    absent: true,
  });
});

test("signed-out fallback recognizes secondary rate-limit responses", async () => {
  const endpoint = buildEndpoint(ENDPOINTS.repository, {
    owner: "octo",
    repo: "hello",
  });
  await assert.rejects(
    runSignedOutGitHubApi(endpoint, {
      fetcher: async () =>
        new Response("{}", {
          status: 403,
          headers: {
            "retry-after": "60",
            "x-ratelimit-remaining": "42",
          },
        }),
    }),
    (error: unknown) =>
      error instanceof GhApiError && error.category === "rate_limit",
  );
});

test("public runner falls back only for server failures", async () => {
  const endpoint = buildEndpoint(ENDPOINTS.repository, {
    owner: "octo",
    repo: "hello",
  });
  const calls: string[] = [];
  const recovered = await runPublicGitHubApi(endpoint, {
    primary: async () => {
      calls.push("primary");
      throw new GhApiError("server");
    },
    fallback: async () => {
      calls.push("fallback");
      return { status: 200, headers: {}, body: { ok: true } };
    },
  });

  assert.deepEqual(recovered.body, { ok: true });
  assert.deepEqual(calls, ["primary", "fallback"]);

  for (const category of ["auth", "rate_limit", "protocol"] as const) {
    calls.length = 0;
    await assert.rejects(
      runPublicGitHubApi(endpoint, {
        primary: async () => {
          calls.push("primary");
          throw new GhApiError(category);
        },
        fallback: async () => {
          calls.push("fallback");
          return { status: 200, headers: {}, body: {} };
        },
      }),
      (error: unknown) =>
        error instanceof GhApiError && error.category === category,
    );
    assert.deepEqual(calls, ["primary"]);
  }
});

test("signed-out fallback bounds response bytes and sanitizes failures", async () => {
  const endpoint = buildEndpoint(ENDPOINTS.repository, {
    owner: "octo",
    repo: "hello",
  });
  await assert.rejects(
    runSignedOutGitHubApi(endpoint, {
      maxOutputBytes: 4,
      fetcher: async () => new Response("12345", { status: 200 }),
    }),
    (error: unknown) =>
      error instanceof GhApiError &&
      error.category === "output" &&
      !error.message.includes("12345"),
  );

  await assert.rejects(
    runSignedOutGitHubApi(endpoint, {
      fetcher: async () => {
        throw new Error("ghp_syntheticcredentialthatmustneverappear");
      },
    }),
    (error: unknown) =>
      error instanceof GhApiError &&
      error.category === "exit" &&
      !error.message.includes("syntheticcredential"),
  );
});

test("signed-out fallback keeps its timeout active while reading the body", async () => {
  const endpoint = buildEndpoint(ENDPOINTS.repository, {
    owner: "octo",
    repo: "hello",
  });
  await assert.rejects(
    runSignedOutGitHubApi(endpoint, {
      timeoutMs: 5,
      fetcher: async (_input, init) =>
        new Response(
          new ReadableStream({
            start(controller) {
              init?.signal?.addEventListener("abort", () => {
                controller.error(
                  new Error("ghp_syntheticcredentialthatmustneverappear"),
                );
              });
            },
          }),
          { status: 200 },
        ),
    }),
    (error: unknown) =>
      error instanceof GhApiError &&
      error.category === "timeout" &&
      !error.message.includes("syntheticcredential"),
  );
});
