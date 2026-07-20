import {
  DEFAULT_TIMEOUT_MS,
  GhApiError,
  MAX_OUTPUT_BYTES,
  runGhApi,
} from "../process/gh-runner.js";
import type { BuiltEndpoint } from "./contracts.js";
import { ENDPOINTS } from "./endpoints.js";

type GitHubApiResponse = Awaited<ReturnType<typeof runGhApi>>;
type GitHubApiRun = (endpoint: BuiltEndpoint) => Promise<GitHubApiResponse>;
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const safeMessage = (category: GhApiError["category"]) =>
  `GitHub request failed (${category})`;

function validateEndpoint(endpoint: BuiltEndpoint): void {
  if (
    endpoint?.__brand !== "BuiltEndpoint" ||
    !Object.values(ENDPOINTS).includes(endpoint.contract as never)
  )
    throw new GhApiError("protocol", safeMessage("protocol"));
}

async function cancelBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Response cleanup is best effort after a terminal status or size limit.
  }
}

async function readBoundedBody(
  response: Response,
  maxOutputBytes: number,
  signal: AbortSignal,
): Promise<string> {
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) {
      await cancelBody(response);
      throw new GhApiError("protocol", safeMessage("protocol"));
    }
    if (Number(contentLength) > maxOutputBytes) {
      await cancelBody(response);
      throw new GhApiError("output", safeMessage("output"));
    }
  }
  if (response.body === null) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    let chunk: ReadableStreamReadResult<Uint8Array>;
    try {
      chunk = await reader.read();
    } catch {
      const category = signal.aborted ? "timeout" : "exit";
      throw new GhApiError(category, safeMessage(category));
    }
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > maxOutputBytes) {
      try {
        await reader.cancel();
      } catch {
        // The size limit is already terminal; cancellation is best effort.
      }
      throw new GhApiError("output", safeMessage("output"));
    }
    chunks.push(chunk.value);
  }
  return Buffer.concat(
    chunks.map((chunk) => Buffer.from(chunk)),
    size,
  ).toString("utf8");
}

export async function runSignedOutGitHubApi(
  endpoint: BuiltEndpoint,
  options: {
    fetcher?: FetchLike;
    timeoutMs?: number;
    maxOutputBytes?: number;
  } = {},
): Promise<GitHubApiResponse> {
  validateEndpoint(endpoint);
  const url = new URL(endpoint.path, "https://api.github.com");
  if (url.origin !== "https://api.github.com")
    throw new GhApiError("protocol", safeMessage("protocol"));

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  try {
    let response: Response;
    try {
      response = await (options.fetcher ?? fetch)(url.toString(), {
        method: "GET",
        redirect: "manual",
        credentials: "omit",
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "oss-evidence signed-out-api-fallback",
          "X-GitHub-Api-Version": "2026-03-10",
        },
        signal: controller.signal,
      });
    } catch {
      const category = controller.signal.aborted ? "timeout" : "exit";
      throw new GhApiError(category, safeMessage(category));
    }

    const status = response.status;
    if (!Number.isInteger(status) || status < 100 || status > 599) {
      await cancelBody(response);
      throw new GhApiError("protocol", safeMessage("protocol"));
    }
    const headers: Record<string, string> = {};
    const link = response.headers.get("link") ?? undefined;
    if (
      (status === 404 && endpoint.contract.absence === "404") ||
      (status === 204 && endpoint.contract.absence === "204")
    ) {
      await cancelBody(response);
      return {
        status,
        headers,
        body: undefined,
        ...(link ? { link } : {}),
        absent: true,
      };
    }
    if (status === 401 || status === 403) {
      const category =
        response.headers.get("x-ratelimit-remaining") === "0"
          ? "rate_limit"
          : "auth";
      await cancelBody(response);
      throw new GhApiError(category, safeMessage(category));
    }
    if (status === 429) {
      await cancelBody(response);
      throw new GhApiError("rate_limit", safeMessage("rate_limit"));
    }
    if (status >= 500) {
      await cancelBody(response);
      throw new GhApiError("server", safeMessage("server"));
    }
    if (status >= 300) {
      await cancelBody(response);
      throw new GhApiError("protocol", safeMessage("protocol"));
    }
    if (status === 204) {
      await cancelBody(response);
      return {
        status,
        headers,
        body: undefined,
        ...(link ? { link } : {}),
        absent: true,
      };
    }

    const bodyText = await readBoundedBody(
      response,
      options.maxOutputBytes ?? MAX_OUTPUT_BYTES,
      controller.signal,
    );
    let body: unknown;
    try {
      body = JSON.parse(bodyText);
    } catch {
      throw new GhApiError("json", safeMessage("json"));
    }
    return { status, headers, body, ...(link ? { link } : {}) };
  } finally {
    clearTimeout(timer);
  }
}

export async function runPublicGitHubApi(
  endpoint: BuiltEndpoint,
  options: { primary?: GitHubApiRun; fallback?: GitHubApiRun } = {},
): Promise<GitHubApiResponse> {
  try {
    return await (options.primary ?? runGhApi)(endpoint);
  } catch (error) {
    if (!(error instanceof GhApiError) || error.category !== "server")
      throw error;
    return (options.fallback ?? runSignedOutGitHubApi)(endpoint);
  }
}
