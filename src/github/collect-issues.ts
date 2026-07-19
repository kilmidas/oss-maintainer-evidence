import { z } from "zod";
import type { Report } from "../domain/report.js";
import type { Page } from "./collect-repository.js";

const issueCandidateSchema = z
  .object({
    id: z.union([z.string().min(1), z.number().int().nonnegative().safe()]),
    number: z.number().int().positive(),
    title: z.string(),
    html_url: z.string().url(),
    user: z.object({ login: z.string().min(1) }).nullable(),
    created_at: z.string(),
    pull_request: z.unknown().optional(),
  })
  .strip();

const issueDetailSchema = issueCandidateSchema
  .extend({
    closed_at: z.string().nullable().optional(),
    closed_by: z
      .object({ login: z.string().min(1) })
      .nullable()
      .optional(),
  })
  .strip();

const commentSchema = z
  .object({
    id: z.union([
      z.string().regex(/^\d+$/),
      z.number().int().nonnegative().safe(),
    ]),
    html_url: z.string().url(),
    issue_url: z.string().url(),
    user: z.object({ login: z.string().min(1) }).nullable(),
    created_at: z.string(),
    body: z.string().optional(),
  })
  .strip();

export interface IssueCollectionInput {
  owner: string;
  repo: string;
  maintainer: string;
  since: string;
  until: string;
  maxItems: number;
}

export interface IssueCollectionDeps {
  searchOpened(query: string, maxItems: number): Promise<Page<unknown>>;
  searchClosed(query: string, maxItems: number): Promise<Page<unknown>>;
  listComments(since: string, maxItems: number): Promise<Page<unknown>>;
  getIssue(number: number): Promise<unknown>;
}

export interface IssueEvidence {
  id: string;
  type: "opened_issue" | "closed_issue" | "issue_comment";
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

const issueUrl = (
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
      `/${owner}/${repo}/issues/${number}`.toLowerCase()
  );
};

const commentUrl = (
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
      `/${owner}/${repo}/issues/${number}`.toLowerCase() &&
    url.hash === `#issuecomment-${id}`
  );
};

const issueNumber = (value: string, owner: string, repo: string) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const match = url.pathname.match(
    /^\/repos\/([^/]+)\/([^/]+)\/issues\/(\d+)$/,
  );
  if (
    url.protocol !== "https:" ||
    url.hostname !== "api.github.com" ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash ||
    !match ||
    match[1].toLowerCase() !== owner.toLowerCase() ||
    match[2].toLowerCase() !== repo.toLowerCase()
  )
    return null;
  const number = Number(match[3]);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
};

const limitation = (resource: string) => ({
  code: `${resource}_truncated`,
  resource,
  message: `${resource} collection reached the configured item limit.`,
});

export async function collectIssues(
  input: IssueCollectionInput,
  deps: IssueCollectionDeps,
) {
  const since = instant(input.since);
  const until = instant(input.until);
  if (since === null || until === null || since > until)
    throw new Error("invalid collection window");
  const range = `${input.since}..${input.until}`;
  const base = `repo:${input.owner}/${input.repo} is:public is:issue`;
  const openedPage = await deps.searchOpened(
    `${base} author:${input.maintainer} created:${range}`,
    input.maxItems,
  );
  const closedPage = await deps.searchClosed(
    `${base} is:closed closed:${range}`,
    input.maxItems,
  );
  const commentSince = new Date(since - 1_000).toISOString();
  const commentPage = await deps.listComments(commentSince, input.maxItems);

  const openedIssues: IssueEvidence[] = [];
  const openedSeen = new Set<number>();
  for (const raw of openedPage.items) {
    const issue = issueCandidateSchema.parse(raw);
    if ("pull_request" in issue || openedSeen.has(issue.number)) continue;
    openedSeen.add(issue.number);
    const occurred = instant(issue.created_at);
    if (
      occurred === null ||
      occurred < since ||
      occurred > until ||
      !issue.user ||
      issue.user.login.toLowerCase() !== input.maintainer.toLowerCase()
    )
      continue;
    if (!issueUrl(issue.html_url, input.owner, input.repo, issue.number))
      throw new Error("invalid issue source URL");
    openedIssues.push({
      id: String(issue.id),
      type: "opened_issue",
      actor: issue.user.login,
      occurredAt: new Date(occurred).toISOString(),
      url: issue.html_url,
      title: issue.title,
      attributionRule: "issue.user.login and issue.created_at",
    });
  }

  const issueCache = new Map<number, z.infer<typeof issueDetailSchema>>();
  const loadIssue = async (number: number) => {
    const cached = issueCache.get(number);
    if (cached) return cached;
    const issue = issueDetailSchema.parse(await deps.getIssue(number));
    if (issue.number !== number) throw new Error("issue detail mismatch");
    issueCache.set(number, issue);
    return issue;
  };

  const closedIssues: IssueEvidence[] = [];
  const closedSeen = new Set<number>();
  for (const raw of closedPage.items) {
    const candidate = issueCandidateSchema.parse(raw);
    if ("pull_request" in candidate || closedSeen.has(candidate.number))
      continue;
    closedSeen.add(candidate.number);
    const issue = await loadIssue(candidate.number);
    if ("pull_request" in issue) continue;
    const occurred = issue.closed_at ? instant(issue.closed_at) : null;
    if (
      occurred === null ||
      occurred < since ||
      occurred > until ||
      !issue.closed_by ||
      issue.closed_by.login.toLowerCase() !== input.maintainer.toLowerCase()
    )
      continue;
    if (!issueUrl(issue.html_url, input.owner, input.repo, issue.number))
      throw new Error("invalid issue source URL");
    closedIssues.push({
      id: String(issue.id),
      type: "closed_issue",
      actor: issue.closed_by.login,
      occurredAt: new Date(occurred).toISOString(),
      url: issue.html_url,
      title: issue.title,
      attributionRule: "issue.closed_by.login and issue.closed_at",
    });
  }

  const issueComments: IssueEvidence[] = [];
  const commentSeen = new Set<string>();
  for (const raw of commentPage.items) {
    const comment = commentSchema.parse(raw);
    const id = String(comment.id);
    if (commentSeen.has(id)) continue;
    commentSeen.add(id);
    const number = issueNumber(comment.issue_url, input.owner, input.repo);
    if (number === null) throw new Error("invalid parent issue URL");
    const parent = await loadIssue(number);
    if ("pull_request" in parent) continue;
    const occurred = instant(comment.created_at);
    if (
      occurred === null ||
      occurred < since ||
      occurred > until ||
      !comment.user ||
      comment.user.login.toLowerCase() !== input.maintainer.toLowerCase()
    )
      continue;
    if (!commentUrl(comment.html_url, input.owner, input.repo, number, id))
      throw new Error("invalid issue comment source URL");
    issueComments.push({
      id,
      type: "issue_comment",
      actor: comment.user.login,
      occurredAt: new Date(occurred).toISOString(),
      url: comment.html_url,
      title: `Comment on ${parent.title}`,
      attributionRule: "comment.user.login and comment.created_at",
    });
  }

  const limitations: Report["limitations"] = [];
  if (openedPage.truncated) limitations.push(limitation("openedIssues"));
  if (closedPage.truncated) limitations.push(limitation("closedIssues"));
  if (commentPage.truncated) limitations.push(limitation("issueComments"));
  return {
    activities: { openedIssues, closedIssues, issueComments },
    pagination: {
      openedIssues: {
        fetched: openedPage.fetched,
        truncated: openedPage.truncated,
      },
      closedIssues: {
        fetched: closedPage.fetched,
        truncated: closedPage.truncated,
      },
      issueComments: {
        fetched: commentPage.fetched,
        truncated: commentPage.truncated,
      },
    },
    limitations,
    partial: limitations.length > 0,
  };
}
