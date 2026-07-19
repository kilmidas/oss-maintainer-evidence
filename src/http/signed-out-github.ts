import { publicGithubUrlSchema } from "../domain/report.js";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export type TargetVerificationResult =
  | { status: "pass"; httpStatus: number; finalUrl: string }
  | { status: "fail"; reason: string; httpStatus?: number };

export interface SignedOutRequestOptions {
  fetcher?: FetchLike;
  timeoutMs?: number;
  maxRedirects?: number;
}

function canonicalTarget(value: string): string | undefined {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }
  url.hash = "";
  const canonical = url.toString();
  return publicGithubUrlSchema.safeParse(canonical).success
    ? canonical
    : undefined;
}

async function cancelBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Status and redirect metadata are sufficient; body cleanup is best effort.
  }
}

export async function verifySignedOutGithubTarget(
  targetUrl: string,
  options: SignedOutRequestOptions = {},
): Promise<TargetVerificationResult> {
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const initialTarget = canonicalTarget(targetUrl);
  if (initialTarget === undefined) {
    return { status: "fail", reason: "invalid_target" };
  }

  let currentUrl = initialTarget;
  let redirects = 0;
  const visited = new Set([currentUrl]);

  while (true) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetcher(currentUrl, {
        method: "GET",
        redirect: "manual",
        credentials: "omit",
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "oss-evidence signed-out-link-verifier",
        },
        signal: controller.signal,
      });
    } catch {
      return {
        status: "fail",
        reason: controller.signal.aborted ? "timeout" : "network",
      };
    } finally {
      clearTimeout(timer);
    }

    let status: number;
    let location: string | null;
    try {
      status = response.status;
      location = response.headers.get("location");
    } catch {
      await cancelBody(response);
      return { status: "fail", reason: "protocol" };
    }
    await cancelBody(response);

    if (!Number.isInteger(status) || status < 100 || status > 599) {
      return { status: "fail", reason: "protocol" };
    }
    if (status >= 200 && status <= 299) {
      return { status: "pass", httpStatus: status, finalUrl: currentUrl };
    }
    if (!REDIRECT_STATUSES.has(status)) {
      return {
        status: "fail",
        reason: `http_${status}`,
        httpStatus: status,
      };
    }
    if (location === null) {
      return { status: "fail", reason: "redirect_missing" };
    }

    let nextTarget: string | undefined;
    try {
      nextTarget = canonicalTarget(new URL(location, currentUrl).toString());
    } catch {
      nextTarget = undefined;
    }
    if (nextTarget === undefined) {
      return { status: "fail", reason: "redirect_invalid" };
    }
    if (visited.has(nextTarget)) {
      return { status: "fail", reason: "redirect_loop" };
    }
    if (redirects >= maxRedirects) {
      return { status: "fail", reason: "redirect_limit" };
    }

    visited.add(nextTarget);
    redirects += 1;
    currentUrl = nextTarget;
  }
}
