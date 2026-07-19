import type { ChildProcess } from "node:child_process";
import { spawn as nodeSpawn } from "node:child_process";
import type { BuiltEndpoint } from "../github/contracts.js";
import { ENDPOINTS } from "../github/endpoints.js";
export const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
export const DEFAULT_TIMEOUT_MS = 30_000;
const ARGS = [
  "api",
  "--hostname",
  "github.com",
  "--method",
  "GET",
  "--include",
  "-H",
  "Accept: application/vnd.github+json",
  "-H",
  "X-GitHub-Api-Version: 2026-03-10",
];
export type GhErrorCategory =
  | "executable"
  | "timeout"
  | "exit"
  | "protocol"
  | "json"
  | "rate_limit"
  | "auth"
  | "output";
export class GhApiError extends Error {
  constructor(
    public readonly category: GhErrorCategory,
    message = "GitHub request failed",
  ) {
    super(message);
    this.name = "GhApiError";
  }
}
type Spawn = (
  file: string,
  args: readonly string[],
  options: { shell: false; env?: NodeJS.ProcessEnv },
) => ChildProcess;
function safeMessage(category: GhErrorCategory): string {
  return `GitHub request failed (${category})`;
}
export async function runGhApi(
  endpoint: BuiltEndpoint,
  opts: { spawn?: Spawn; timeoutMs?: number } = {},
): Promise<{
  status: number;
  headers: Record<string, string>;
  body: unknown;
  link?: string;
  absent?: boolean;
}> {
  if (
    endpoint?.__brand !== "BuiltEndpoint" ||
    !Object.values(ENDPOINTS).includes(endpoint.contract as never)
  )
    throw new GhApiError("protocol");
  const path = endpoint.path;
  const spawn = opts.spawn ?? (nodeSpawn as unknown as Spawn);
  let child: ChildProcess;
  try {
    child = spawn("gh", [...ARGS, path], { shell: false });
  } catch {
    throw new GhApiError("executable", safeMessage("executable"));
  }
  let limited = false;
  let out: Buffer<ArrayBufferLike> = Buffer.alloc(0),
    err: Buffer<ArrayBufferLike> = Buffer.alloc(0),
    timed = false;
  const append = (
    cur: Buffer<ArrayBufferLike>,
    chunk: Buffer<ArrayBufferLike>,
  ) => {
    if (cur.length + chunk.length > MAX_OUTPUT_BYTES) {
      limited = true;
      child.kill("SIGTERM");
      return cur;
    }
    return Buffer.concat([cur, chunk]);
  };
  child.stdout?.on("data", (c: Buffer) => {
    out = append(out, c);
  });
  child.stderr?.on("data", (c: Buffer) => {
    err = append(err, c);
  });
  const timeout = setTimeout(() => {
    timed = true;
    child.kill("SIGTERM");
  }, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const code = await new Promise<number | null>((resolve, reject) => {
    child.once("error", () =>
      reject(new GhApiError("executable", safeMessage("executable"))),
    );
    child.once("close", resolve);
  });
  clearTimeout(timeout);
  if (timed) throw new GhApiError("timeout", safeMessage("timeout"));
  if (limited) throw new GhApiError("output", safeMessage("output"));
  const framing = out.toString();
  const split = framing.indexOf("\r\n\r\n");
  if (split < 0) {
    if (code !== 0) {
      const text = err.toString().toLowerCase();
      const category: GhErrorCategory = text.includes("rate limit")
        ? "rate_limit"
        : text.includes("auth") || text.includes("login")
          ? "auth"
          : "exit";
      throw new GhApiError(category, safeMessage(category));
    }
    throw new GhApiError("protocol", safeMessage("protocol"));
  }
  const lines = framing.slice(0, split).split(/\r\n/);
  const m = lines[0].match(/^HTTP\/\d(?:\.\d)?\s+(\d{3})\b/i);
  if (!m) throw new GhApiError("protocol", safeMessage("protocol"));
  const headers: Record<string, string> = {};
  let link: string | undefined;
  for (const line of lines.slice(1)) {
    const i = line.indexOf(":");
    if (i < 1) continue;
    const k = line.slice(0, i).toLowerCase();
    if (k === "link") link = line.slice(i + 1).trim();
  }
  const status = Number(m[1]);
  const bodyText = framing.slice(split + 4).trim();
  if (
    (status === 404 && endpoint.contract.absence === "404") ||
    (status === 204 && endpoint.contract.absence === "204")
  )
    return { status, headers, body: undefined, link, absent: true };
  if (status === 401 || status === 403)
    throw new GhApiError("auth", safeMessage("auth"));
  if (status === 429)
    throw new GhApiError("rate_limit", safeMessage("rate_limit"));
  if (code !== 0 || status >= 400)
    throw new GhApiError("exit", safeMessage("exit"));
  if (status === 204)
    return { status, headers, body: undefined, link, absent: true };
  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    throw new GhApiError("json", safeMessage("json"));
  }
  return { status, headers, body, ...(link ? { link } : {}) };
}
