import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const projectRoot = resolve(".");
const cli = resolve("dist/cli.js");
const secret = "ghp_syntheticcredentialthatmustneverappear";
const fakeFetch = resolve("test/fixtures/fake-fetch.mjs");
const completeReport = resolve("test/golden/report-complete.json");

const withFakeGh = (run: (directory: string) => void) => {
  const directory = mkdtempSync(join(tmpdir(), "oss-evidence-cli-"));
  const bin = join(directory, "bin");
  mkdirSync(bin);
  copyFileSync(resolve("test/fixtures/fake-gh.mjs"), join(bin, "gh"));
  chmodSync(join(bin, "gh"), 0o755);
  try {
    run(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

const invoke = (directory: string, extra: string[], mode = "complete") =>
  spawnSync(
    process.execPath,
    [
      cli,
      "collect",
      "acme/demo",
      "--maintainer",
      "Alice",
      "--since",
      "90d",
      ...extra,
    ],
    {
      cwd: projectRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${join(directory, "bin")}:${process.env.PATH ?? ""}`,
        FAKE_GH_MODE: mode,
        SYNTHETIC_TOKEN: secret,
      },
    },
  );

test("CLI integration renders complete Markdown and JSON to stdout", () => {
  withFakeGh((directory) => {
    const markdown = invoke(directory, ["--format", "markdown"]);
    assert.equal(markdown.status, 0, markdown.stderr);
    assert.match(markdown.stdout, /^# OSS Maintainer Evidence/m);
    assert.equal(markdown.stderr, "");
    const json = invoke(directory, ["--format", "json"]);
    assert.equal(json.status, 0, json.stderr);
    assert.equal(JSON.parse(json.stdout).status, "complete");
    assert.equal(json.stderr, "");
  });
});

test("CLI integration creates a new file atomically and never overwrites", () => {
  withFakeGh((directory) => {
    const output = join(directory, "evidence.json");
    const first = invoke(directory, ["--format", "json", "--output", output]);
    assert.equal(first.status, 0, first.stderr);
    assert.equal(first.stdout, "");
    assert.equal(JSON.parse(readFileSync(output, "utf8")).status, "complete");
    const before = readFileSync(output, "utf8");
    const second = invoke(directory, ["--format", "json", "--output", output]);
    assert.equal(second.status, 5);
    assert.equal(readFileSync(output, "utf8"), before);
    assert.deepEqual(
      readdirSync(directory).filter((name) => name.endsWith(".tmp")),
      [],
    );
  });
});

test("CLI integration emits partial reports with exit 4", () => {
  withFakeGh((directory) => {
    const result = invoke(directory, ["--format", "json"], "partial");
    assert.equal(result.status, 4);
    assert.equal(JSON.parse(result.stdout).status, "partial");
    assert.match(result.stderr, /partial/i);
    assert.equal(result.stderr.includes(secret), false);
  });
});

test("CLI integration emits no report on required failures", () => {
  withFakeGh((directory) => {
    const result = invoke(directory, ["--format", "json"], "required_failure");
    assert.equal(result.status, 3);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr.includes(secret), false);
  });
});

test("CLI integration maps invalid input and directory output errors", () => {
  withFakeGh((directory) => {
    const invalid = spawnSync(process.execPath, [cli, "collect", "bad"], {
      cwd: projectRoot,
      encoding: "utf8",
    });
    assert.equal(invalid.status, 2);
    assert.equal(invalid.stdout, "");
    const output = invoke(directory, [
      "--format",
      "json",
      "--output",
      directory,
    ]);
    assert.equal(output.status, 5);
    assert.equal(output.stdout, "");
  });
});

const invokeVerify = (mode: string, reportPath = completeReport) =>
  spawnSync(
    process.execPath,
    ["--import", fakeFetch, cli, "verify", reportPath],
    {
      cwd: projectRoot,
      encoding: "utf8",
      env: { ...process.env, FAKE_FETCH_MODE: mode, SYNTHETIC_TOKEN: secret },
    },
  );

test("CLI integration verifies a valid report and exits zero", () => {
  const result = invokeVerify("pass");

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^PASS 200 https:\/\/github\.com\/acme\/demo$/m);
  assert.match(
    result.stdout,
    /Verified 1 of 1 evidence links; 1 unique HTTP targets\.$/m,
  );
  assert.equal(result.stderr, "");
});

test("CLI integration renders failed links and exits six", () => {
  const result = invokeVerify("not-found");

  assert.equal(result.status, 6, result.stderr);
  assert.match(
    result.stdout,
    /^FAIL http_404 https:\/\/github\.com\/acme\/demo$/m,
  );
  assert.equal(result.stderr, "");
});

test("CLI integration rejects invalid reports before output", () => {
  const result = invokeVerify("pass", resolve("package.json"));

  assert.equal(result.status, 2);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /schema version 1\.0/i);
});

test("CLI integration never exposes transport failure details", () => {
  const result = invokeVerify("network-error");

  assert.equal(result.status, 6);
  assert.match(result.stdout, /^FAIL network /m);
  assert.equal(result.stdout.includes(secret), false);
  assert.equal(result.stderr.includes(secret), false);
});
