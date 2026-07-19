import type { CollectInput } from "../domain/input.js";
import type { Report } from "../domain/report.js";
import { GithubClient } from "../github/client.js";
import { collectIssues } from "../github/collect-issues.js";
import { collectPulls } from "../github/collect-pulls.js";
import {
  type ContentResult,
  collectRepository,
} from "../github/collect-repository.js";
import { ENDPOINTS } from "../github/endpoints.js";
import { GhApiError } from "../process/gh-runner.js";
import { collectEvidence } from "./collect.js";

const arrayBody = (body: unknown): unknown[] => {
  if (!Array.isArray(body)) throw new GhApiError("protocol");
  return body;
};

const safeBranch = (branch: string) =>
  /^[A-Za-z0-9][A-Za-z0-9._/-]{0,254}$/.test(branch) &&
  !branch.includes("..") &&
  !branch.includes("//") &&
  !branch.endsWith("/");

const blobUrl = (owner: string, repo: string, branch: string, path: string) =>
  `https://github.com/${owner}/${repo}/blob/${branch
    .split("/")
    .map(encodeURIComponent)
    .join("/")}/${path.split("/").map(encodeURIComponent).join("/")}`;

export async function runCollection(input: CollectInput): Promise<Report> {
  const client = new GithubClient();
  return collectEvidence(input, {
    preflight: async (owner, repo) => client.preflight(owner, repo),
    collectRepository: async (value) => {
      const { owner, name: repo } = value.repository;
      if (!safeBranch(value.defaultBranch)) throw new GhApiError("protocol");
      return collectRepository(
        {
          owner,
          repo,
          maintainer: value.maintainer,
          since: value.since,
          until: value.until,
          maxItems: value.maxItems,
          observedAt: value.observedAt,
          defaultBranch: value.defaultBranch,
        },
        {
          getRepository: async () =>
            (await client.request(ENDPOINTS.repository, { owner, repo })).body,
          listReleases: async (maxItems) =>
            client.paginate(
              ENDPOINTS.releases,
              { owner, repo },
              maxItems,
              arrayBody,
            ),
          getCommunityProfile: async () => {
            const response = await client.request(ENDPOINTS.communityProfile, {
              owner,
              repo,
            });
            return response.absent ? { files: {} } : response.body;
          },
          getContent: async (path): Promise<ContentResult> => {
            try {
              const response = await client.request(ENDPOINTS.contents, {
                owner,
                repo,
                path,
                ref: value.defaultBranch,
              });
              if (response.absent) return { status: "absent" };
              return {
                status: "present",
                sourceUrl: blobUrl(owner, repo, value.defaultBranch, path),
              };
            } catch {
              return { status: "unavailable" };
            }
          },
          listContributors: async (maxItems) =>
            client.paginate(
              ENDPOINTS.contributors,
              { owner, repo, anon: "false" },
              maxItems,
              arrayBody,
            ),
        },
      );
    },
    collectPulls: async (value) => {
      const { owner, name: repo } = value.repository;
      return collectPulls(
        {
          owner,
          repo,
          maintainer: value.maintainer,
          since: value.since,
          until: value.until,
          maxItems: value.maxItems,
        },
        {
          searchAuthored: (query, maxItems) => client.search(query, maxItems),
          searchMerged: (query, maxItems) => client.search(query, maxItems),
          searchReviewed: (query, maxItems) => client.search(query, maxItems),
          getPull: async (number) =>
            (await client.request(ENDPOINTS.pull, { owner, repo, number }))
              .body,
          listReviews: (number, maxItems) =>
            client.paginate(
              ENDPOINTS.pullReviews,
              { owner, repo, number },
              maxItems,
              arrayBody,
            ),
        },
      );
    },
    collectIssues: async (value) => {
      const { owner, name: repo } = value.repository;
      return collectIssues(
        {
          owner,
          repo,
          maintainer: value.maintainer,
          since: value.since,
          until: value.until,
          maxItems: value.maxItems,
        },
        {
          searchOpened: (query, maxItems) => client.search(query, maxItems),
          searchClosed: (query, maxItems) => client.search(query, maxItems),
          listComments: (since, maxItems) =>
            client.paginate(
              ENDPOINTS.repositoryIssueComments,
              { owner, repo, since, sort: "created", direction: "asc" },
              maxItems,
              arrayBody,
            ),
          getIssue: async (number) =>
            (await client.request(ENDPOINTS.issue, { owner, repo, number }))
              .body,
        },
      );
    },
  });
}
