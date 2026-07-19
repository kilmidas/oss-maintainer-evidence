import { z } from "zod";

const githubUrl = z
  .string()
  .regex(
    /^https:\/\/github\.com\/(?!.*(?:\/\/|\/$|(?:^|\/)\.(?:\.|\/)|%2e|%2f))[^\s?#]+$/i,
  )
  .refine((v) => {
    let u: URL;
    try {
      u = new URL(v);
    } catch {
      return false;
    }
    const rawPath = u.pathname;
    let decoded: string;
    try {
      decoded = decodeURIComponent(rawPath);
    } catch {
      return false;
    }
    const seg = decoded.split("/").filter(Boolean);
    return (
      u.protocol === "https:" &&
      u.hostname === "github.com" &&
      !u.username &&
      !u.password &&
      !u.port &&
      !u.search &&
      !u.hash &&
      !rawPath.endsWith("/") &&
      !rawPath.includes("//") &&
      !seg.some((s) => s === "." || s === "..") &&
      !/%2e|%2f/i.test(rawPath)
    );
  });
export const publicGithubUrlSchema = githubUrl;
const utc = z
  .string()
  .regex(
    /^\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\d|30)|02-(?:0[1-9]|1\d|2[0-9]))T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/,
  )
  .refine((v) => {
    const m = v.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/,
    );
    if (!m) return false;
    const d = new Date(v);
    return (
      d.getUTCFullYear() === +m[1] &&
      d.getUTCMonth() + 1 === +m[2] &&
      d.getUTCDate() === +m[3] &&
      d.getUTCHours() === +m[4] &&
      d.getUTCMinutes() === +m[5] &&
      d.getUTCSeconds() === +m[6]
    );
  });
const activityGithubUrl = z.string().refine((value) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  const fragment = url.hash;
  url.hash = "";
  return (
    (!fragment || /^#(?:pullrequestreview|issuecomment)-\d+$/.test(fragment)) &&
    githubUrl.safeParse(url.toString()).success
  );
});
const keys = [
  "releases",
  "authoredPullRequests",
  "mergedPullRequests",
  "reviews",
  "openedIssues",
  "closedIssues",
  "issueComments",
] as const;
const literals = [
  "release",
  "authored_pull_request",
  "merged_pull_request",
  "review",
  "opened_issue",
  "closed_issue",
  "issue_comment",
] as const;
const paginationKeys = [...keys, "contributors"] as const;
const base = {
  id: z.string().min(1),
  actor: z.string().min(1),
  occurredAt: utc,
  url: activityGithubUrl,
  title: z.string(),
  attributionRule: z.string().min(1),
};
const item = (type: (typeof literals)[number]) =>
  z.object({ ...base, type: z.literal(type) }).strict();
export const reportSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    generatedAt: utc,
    status: z.enum(["complete", "partial"]),
    query: z
      .object({
        repository: z
          .object({
            owner: z.string().min(1),
            name: z.string().min(1),
            fullName: z.string().min(3),
          })
          .strict(),
        maintainer: z.string().min(1),
        since: utc,
        until: utc,
        maxItems: z.number().int().positive().max(1000),
      })
      .strict(),
    repository: z
      .object({
        owner: z.string().min(1),
        name: z.string().min(1),
        fullName: z.string().min(3),
        description: z.string().nullable(),
        sourceUrl: githubUrl,
        observedAt: utc,
      })
      .strict(),
    activities: z
      .object(
        Object.fromEntries(
          keys.map((k, i) => [k, z.array(item(literals[i]))]),
        ) as never,
      )
      .strict(),
    summary: z
      .object(
        Object.fromEntries([
          ...keys.map((k) => [k, z.number().int().nonnegative()]),
          ["total", z.number().int().nonnegative()],
        ]) as never,
      )
      .strict(),
    community: z.record(
      z.string(),
      z.discriminatedUnion("status", [
        z
          .object({ status: z.literal("present"), sourceUrl: githubUrl })
          .strict(),
        z
          .object({
            status: z.literal("absent"),
            sourceUrl: githubUrl.nullable().optional(),
          })
          .strict(),
        z
          .object({
            status: z.literal("unavailable"),
            sourceUrl: githubUrl.nullable().optional(),
          })
          .strict(),
      ]),
    ),
    adoption: z
      .object({
        stars: z.number().int().nonnegative().nullable(),
        forks: z.number().int().nonnegative().nullable(),
        watchers: z.number().int().nonnegative().nullable(),
        contributors: z.number().int().nonnegative().nullable(),
        observedAt: utc.nullable(),
      })
      .strict(),
    pagination: z
      .object(
        Object.fromEntries(
          paginationKeys.map((k) => [
            k,
            z
              .object({
                fetched: z.number().int().nonnegative(),
                truncated: z.boolean(),
              })
              .strict(),
          ]),
        ) as never,
      )
      .strict(),
    limitations: z.array(
      z
        .object({
          code: z.string().min(1),
          resource: z.string().min(1),
          message: z.string().min(1),
        })
        .strict(),
    ),
  })
  .strict();
export type Report = z.infer<typeof reportSchema>;
