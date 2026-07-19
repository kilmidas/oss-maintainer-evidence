import type { BuiltEndpoint, EndpointContract } from "./contracts.js";
export const ENDPOINTS = {
  repository: {
    key: "repository",
    template: "/repos/{owner}/{repo}",
    pagination: "none",
    absence: "404",
    activity: "required",
    queryKeys: [],
  },
  releases: {
    key: "releases",
    template: "/repos/{owner}/{repo}/releases",
    pagination: "page",
    absence: "404",
    activity: "required",
    queryKeys: ["page", "per_page"],
  },
  searchIssues: {
    key: "searchIssues",
    template: "/search/issues",
    pagination: "page",
    absence: "none",
    activity: "required",
    queryKeys: ["q", "page", "per_page", "sort", "order"],
  },
  pull: {
    key: "pull",
    template: "/repos/{owner}/{repo}/pulls/{number}",
    pagination: "none",
    absence: "404",
    activity: "required",
    queryKeys: [],
  },
  pullReviews: {
    key: "pullReviews",
    template: "/repos/{owner}/{repo}/pulls/{number}/reviews",
    pagination: "page",
    absence: "404",
    activity: "required",
    queryKeys: ["page", "per_page"],
  },
  issue: {
    key: "issue",
    template: "/repos/{owner}/{repo}/issues/{number}",
    pagination: "none",
    absence: "404",
    activity: "required",
    queryKeys: [],
  },
  issueComments: {
    key: "issueComments",
    template: "/repos/{owner}/{repo}/issues/{number}/comments",
    pagination: "page",
    absence: "404",
    activity: "required",
    queryKeys: ["page", "per_page"],
  },
  repositoryIssueComments: {
    key: "repositoryIssueComments",
    template: "/repos/{owner}/{repo}/issues/comments",
    pagination: "page",
    absence: "404",
    activity: "required",
    queryKeys: ["since", "sort", "direction", "page", "per_page"],
  },
  communityProfile: {
    key: "communityProfile",
    template: "/repos/{owner}/{repo}/community/profile",
    pagination: "none",
    absence: "404",
    activity: "optional",
    queryKeys: [],
  },
  contents: {
    key: "contents",
    template: "/repos/{owner}/{repo}/contents/{path}",
    pagination: "none",
    absence: "404",
    activity: "optional",
    queryKeys: ["ref"],
  },
  contributors: {
    key: "contributors",
    template: "/repos/{owner}/{repo}/contributors",
    pagination: "page",
    absence: "404",
    activity: "optional",
    queryKeys: ["page", "per_page", "anon"],
  },
} as const satisfies Record<string, EndpointContract>;
const SAFE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/;
function valid(v: unknown): v is string {
  return typeof v === "string" && SAFE.test(v) && !v.includes("..");
}
export function buildEndpoint(
  contract: EndpointContract,
  params: Record<string, string | number>,
  options: { host?: string } = {},
): BuiltEndpoint {
  if (options.host && options.host !== "github.com")
    throw new Error("invalid host");
  let path = contract.template;
  for (const token of contract.template.match(/\{[^}]+\}/g) ?? []) {
    const key = token.slice(1, -1);
    const value = params[key];
    if (value === undefined || value === null)
      throw new Error("missing path parameter");
    if (key === "path") {
      if (
        typeof value !== "string" ||
        !value ||
        value
          .split("/")
          .some(
            (segment) =>
              !segment ||
              segment === "." ||
              segment === ".." ||
              segment.includes("%") ||
              [...segment].some(
                (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
              ),
          )
      )
        throw new Error("invalid path parameter");
      path = path.replace(
        token,
        value
          .split("/")
          .map((segment) => encodeURIComponent(segment))
          .join("/"),
      );
    } else {
      if (!valid(value)) throw new Error("invalid path parameter");
      path = path.replace(token, encodeURIComponent(String(value)));
    }
  }
  const query = new URLSearchParams();
  for (const key of contract.queryKeys)
    if (params[key] !== undefined) query.set(key, String(params[key]));
  if (query.toString()) path += `?${query}`;
  if (
    !path.startsWith("/repos/") &&
    path !== "/search/issues" &&
    !path.startsWith("/search/issues?")
  )
    throw new Error("invalid route");
  return { path, contract, __brand: "BuiltEndpoint" };
}
