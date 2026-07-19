import assert from "node:assert/strict";
import test from "node:test";
import { buildEndpoint, ENDPOINTS } from "../src/github/endpoints.js";

test("builds fixed GitHub API endpoint and rejects traversal", () => {
  assert.equal(
    buildEndpoint(ENDPOINTS.repository, { owner: "octo", repo: "hello" }).path,
    "/repos/octo/hello",
  );
  assert.throws(() =>
    buildEndpoint(ENDPOINTS.repository, { owner: "../x", repo: "hello" }),
  );
  assert.throws(() =>
    buildEndpoint(ENDPOINTS.searchIssues, { q: "a", page: 1 }, {
      host: "evil.test",
    } as never),
  );
});

test("registry covers all planned route contracts", () => {
  const expected = {
    repository: ["none", "404", "required"],
    releases: ["page", "404", "required"],
    searchIssues: ["page", "none", "required"],
    pull: ["none", "404", "required"],
    pullReviews: ["page", "404", "required"],
    issue: ["none", "404", "required"],
    issueComments: ["page", "404", "required"],
    communityProfile: ["none", "404", "optional"],
    contents: ["none", "404", "optional"],
    contributors: ["page", "404", "optional"],
  } as const;
  for (const [key, values] of Object.entries(expected)) {
    const c = ENDPOINTS[key as keyof typeof ENDPOINTS];
    assert.equal(c.pagination, values[0]);
    assert.equal(c.absence, values[1]);
    assert.equal(c.activity, values[2]);
    assert.match(c.template, /^(\/repos\/|\/search\/issues)/);
  }
});
