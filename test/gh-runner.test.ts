import assert from "node:assert/strict";
import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import test from "node:test";
import { buildEndpoint, ENDPOINTS } from "../src/github/endpoints.js";
import { GhApiError, runGhApi } from "../src/process/gh-runner.js";

type RunOptions = NonNullable<Parameters<typeof runGhApi>[1]>;
type Spawn = NonNullable<RunOptions["spawn"]>;

function mockSpawn(payload: string, seen?: unknown[], code = 0): Spawn {
  return ((_file, args, options) => {
    seen?.push(_file, args, options);
    const child = Object.assign(new EventEmitter(), {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
    }) as unknown as ChildProcess;
    queueMicrotask(() => {
      child.stdout?.emit("data", Buffer.from(payload));
      child.emit("close", code);
    });
    return child;
  }) as Spawn;
}

test("uses fixed safe gh command boundary", async () => {
  const seen: unknown[] = [];
  const endpoint = buildEndpoint(ENDPOINTS.repository, {
    owner: "octo",
    repo: "hello",
  });
  const result = await runGhApi(endpoint, {
    spawn: mockSpawn(
      'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{"ok":true}',
      seen,
    ),
  });
  assert.deepEqual(result.body, { ok: true });
  const options = seen[2] as { shell: boolean };
  assert.equal(options.shell, false);
  assert.deepEqual(seen[1], [
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
    "/repos/octo/hello",
  ]);
});

test("maps malformed response safely", async () => {
  await assert.rejects(
    runGhApi(
      buildEndpoint(ENDPOINTS.repository, { owner: "octo", repo: "hello" }),
      { spawn: mockSpawn("not headers") },
    ),
    (error: unknown) =>
      error instanceof GhApiError && error.category === "protocol",
  );
});

test("maps an expected 404 to absence even when gh exits nonzero", async () => {
  const result = await runGhApi(
    buildEndpoint(ENDPOINTS.contents, {
      owner: "octo",
      repo: "hello",
      path: "SECURITY.md",
    }),
    {
      spawn: mockSpawn(
        'HTTP/1.1 404 Not Found\r\nContent-Type: application/json\r\n\r\n{"message":"Not Found"}',
        undefined,
        1,
      ),
    },
  );
  assert.equal(result.status, 404);
  assert.equal(result.absent, true);
  assert.equal(result.body, undefined);
});
