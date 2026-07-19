import assert from "node:assert/strict";
import test from "node:test";
import { GithubClient } from "../src/github/client.js";

test("preflight accepts only public canonical repositories", async () => {
  const client = new GithubClient({
    run: async () => ({
      status: 200,
      headers: {},
      body: {
        full_name: "acme/demo",
        private: false,
        visibility: "public",
        html_url: "https://github.com/acme/demo",
        default_branch: "main",
      },
    }),
  });
  assert.deepEqual(await client.preflight("acme", "demo"), {
    owner: "acme",
    repo: "demo",
    fullName: "acme/demo",
    defaultBranch: "main",
    fork: false,
  });
});

test("pagination stops at max items and follows only next links", async () => {
  let calls = 0;
  const client = new GithubClient({
    run: async () => {
      calls++;
      return {
        status: 200,
        headers: {},
        body: [1, 2, 3],
        link:
          calls === 1
            ? '<https://github.com/repos/acme/demo/releases?page=2>; rel="next"'
            : undefined,
      };
    },
  });
  const result = await client.paginate(
    {
      key: "releases",
      template: "/repos/{owner}/{repo}/releases",
      pagination: "page",
      absence: "404",
      activity: "required",
      queryKeys: ["page", "per_page"],
    },
    { owner: "acme", repo: "demo" },
    4,
    (body) => body as number[],
  );
  assert.deepEqual(result, {
    items: [1, 2, 3, 1],
    fetched: 4,
    truncated: true,
  });
  assert.equal(calls, 2);
});
