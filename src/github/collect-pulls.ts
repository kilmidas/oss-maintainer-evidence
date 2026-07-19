import { z } from "zod";
import type { Report } from "../domain/report.js";
import type { Page } from "./collect-repository.js";

const searchPullSchema = z
  .object({
    id: z.union([z.string().min(1), z.number().int().nonnegative()]),
    number: z.number().int().positive(),
    title: z.string(),
    html_url: z.string().url(),
    user: z.object({ login: z.string().min(1) }).nullable(),
    created_at: z.string(),
  })
  .strip();

const pullDetailSchema = z
  .object({
    id: z.union([z.string().min(1), z.number().int().nonnegative()]),
    number: z.number().int().positive(),
    title: z.string(),
    html_url: z.string().url(),
    merged_at: z.string().nullable(),
    merged_by: z.object({ login: z.string().min(1) }).nullable(),
  })
  .strip();

const reviewSchema = z
  .object({
    id: z.union([z.string().min(1), z.number().int().nonnegative()]),
    user: z.object({ login: z.string().min(1) }).nullable(),
    submitted_at: z.string().nullable().optional(),
    html_url: z.string().url(),
  })
  .strip();

export interface PullCollectionInput {
  owner: string;
  repo: string;
  maintainer: string;
  since: string;
  until: string;
  maxItems: number;
}

export interface PullCollectionDeps {
  searchAuthored(query: string, maxItems: number): Promise<Page<unknown>>;
  searchMerged(query: string, maxItems: number): Promise<Page<unknown>>;
  searchReviewed(query: string, maxItems: number): Promise<Page<unknown>>;
  getPull(number: number): Promise<unknown>;
  listReviews(number: number, maxItems: number): Promise<Page<unknown>>;
}

export interface PullEvidence {
  id: string;
  type: "authored_pull_request" | "merged_pull_request" | "review";
  actor: string;
  occurredAt: string;
  url: string;
  title: string;
  attributionRule: string;
}

const instant = (value: string) => {
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? milliseconds : null;
};

const pullUrl = (
  value: string,
  owner: string,
  repo: string,
  number: number,
) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    url.hostname === "github.com" &&
    !url.username &&
    !url.password &&
    !url.port &&
    !url.search &&
    !url.hash &&
    url.pathname.toLowerCase() ===
      `/${owner}/${repo}/pull/${number}`.toLowerCase()
  );
};

const reviewUrl = (
  value: string,
  owner: string,
  repo: string,
  number: number,
  id: string,
) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    url.hostname === "github.com" &&
    !url.username &&
    !url.password &&
    !url.port &&
    !url.search &&
    url.pathname.toLowerCase() ===
      `/${owner}/${repo}/pull/${number}`.toLowerCase() &&
    (!url.hash || url.hash === `#pullrequestreview-${id}`)
  );
};

const limitation = (resource: string) => ({
  code: `${resource}_truncated`,
  resource,
  message: `${resource} collection reached the configured item limit.`,
});

export async function collectPulls(
  input: PullCollectionInput,
  deps: PullCollectionDeps,
) {
  const since = instant(input.since);
  const until = instant(input.until);
  if (since === null || until === null || since > until)
    throw new Error("invalid collection window");
  const base = `repo:${input.owner}/${input.repo} is:public is:pr`;
  const range = `${input.since}..${input.until}`;
  const authoredPage = await deps.searchAuthored(
    `${base} author:${input.maintainer} created:${range}`,
    input.maxItems,
  );
  const mergedPage = await deps.searchMerged(
    `${base} is:merged merged:${range}`,
    input.maxItems,
  );
  const reviewedPage = await deps.searchReviewed(
    `${base} reviewed-by:${input.maintainer} updated:${range}`,
    input.maxItems,
  );

  const authoredPullRequests: PullEvidence[] = [];
  const authoredSeen = new Set<number>();
  for (const raw of authoredPage.items) {
    const pull = searchPullSchema.parse(raw);
    if (authoredSeen.has(pull.number)) continue;
    authoredSeen.add(pull.number);
    const occurred = instant(pull.created_at);
    if (
      occurred === null ||
      occurred < since ||
      occurred > until ||
      !pull.user ||
      pull.user.login.toLowerCase() !== input.maintainer.toLowerCase()
    )
      continue;
    if (!pullUrl(pull.html_url, input.owner, input.repo, pull.number))
      throw new Error("invalid pull request source URL");
    authoredPullRequests.push({
      id: String(pull.id),
      type: "authored_pull_request",
      actor: pull.user.login,
      occurredAt: new Date(occurred).toISOString(),
      url: pull.html_url,
      title: pull.title,
      attributionRule: "pull.user.login and pull.created_at",
    });
  }

  const mergedPullRequests: PullEvidence[] = [];
  const mergedSeen = new Set<number>();
  for (const raw of mergedPage.items) {
    const candidate = searchPullSchema.parse(raw);
    if (mergedSeen.has(candidate.number)) continue;
    mergedSeen.add(candidate.number);
    const pull = pullDetailSchema.parse(await deps.getPull(candidate.number));
    if (pull.number !== candidate.number)
      throw new Error("pull request detail mismatch");
    const occurred = pull.merged_at ? instant(pull.merged_at) : null;
    if (
      occurred === null ||
      occurred < since ||
      occurred > until ||
      !pull.merged_by ||
      pull.merged_by.login.toLowerCase() !== input.maintainer.toLowerCase()
    )
      continue;
    if (!pullUrl(pull.html_url, input.owner, input.repo, pull.number))
      throw new Error("invalid pull request source URL");
    mergedPullRequests.push({
      id: String(pull.id),
      type: "merged_pull_request",
      actor: pull.merged_by.login,
      occurredAt: new Date(occurred).toISOString(),
      url: pull.html_url,
      title: pull.title,
      attributionRule: "pull.merged_by.login and pull.merged_at",
    });
  }

  const reviews: PullEvidence[] = [];
  const reviewedCandidates = new Set<number>();
  const reviewIds = new Set<string>();
  let fetchedReviews = 0;
  let reviewsTruncated = reviewedPage.truncated;
  for (const raw of reviewedPage.items) {
    const candidate = searchPullSchema.parse(raw);
    if (reviewedCandidates.has(candidate.number)) continue;
    reviewedCandidates.add(candidate.number);
    if (!pullUrl(candidate.html_url, input.owner, input.repo, candidate.number))
      throw new Error("invalid pull request source URL");
    const page = await deps.listReviews(candidate.number, input.maxItems);
    fetchedReviews += page.fetched;
    reviewsTruncated ||= page.truncated;
    for (const value of page.items) {
      const review = reviewSchema.parse(value);
      const id = String(review.id);
      if (reviewIds.has(id)) continue;
      reviewIds.add(id);
      const occurred = review.submitted_at
        ? instant(review.submitted_at)
        : null;
      if (
        occurred === null ||
        occurred < since ||
        occurred > until ||
        !review.user ||
        review.user.login.toLowerCase() !== input.maintainer.toLowerCase()
      )
        continue;
      if (
        !reviewUrl(
          review.html_url,
          input.owner,
          input.repo,
          candidate.number,
          id,
        )
      )
        throw new Error("invalid review source URL");
      reviews.push({
        id,
        type: "review",
        actor: review.user.login,
        occurredAt: new Date(occurred).toISOString(),
        url: review.html_url,
        title: `Review on ${candidate.title}`,
        attributionRule: "review.user.login and review.submitted_at",
      });
    }
  }

  const limitations: Report["limitations"] = [];
  if (authoredPage.truncated)
    limitations.push(limitation("authoredPullRequests"));
  if (mergedPage.truncated) limitations.push(limitation("mergedPullRequests"));
  if (reviewsTruncated) limitations.push(limitation("reviews"));
  return {
    activities: { authoredPullRequests, mergedPullRequests, reviews },
    pagination: {
      authoredPullRequests: {
        fetched: authoredPage.fetched,
        truncated: authoredPage.truncated,
      },
      mergedPullRequests: {
        fetched: mergedPage.fetched,
        truncated: mergedPage.truncated,
      },
      reviews: { fetched: fetchedReviews, truncated: reviewsTruncated },
    },
    limitations,
    partial: limitations.length > 0,
  };
}
