import assert from "node:assert/strict";
import test from "node:test";
import releases from "./fixtures/releases.json" with { type: "json" };
import { collectRepository } from "../src/github/collect-repository.js";

test("collects case-insensitive published releases and adoption counters", async () => {
  const out = await collectRepository({ owner:"acme", repo:"demo", maintainer:"maintainer", since:"2024-01-01T00:00:00Z", until:"2024-01-01T00:00:00Z", maxItems:10, observedAt:"2024-01-02T00:00:00Z", defaultBranch:"main" }, {
    getRepository: async () => ({ full_name:"acme/demo", description:null, html_url:"https://github.com/acme/demo", default_branch:"main", stargazers_count:2, forks_count:1, subscribers_count:4 }),
    listReleases: async () => ({items:releases, fetched:1, truncated:false}), getCommunityProfile: async () => ({}), getContent: async () => ({}), listContributors: async () => ({items:[],fetched:0,truncated:false}),
  });
  assert.equal(out.releases.length, 1); assert.equal(out.adoption.watchers, 4); assert.equal(out.partial, false);
});
