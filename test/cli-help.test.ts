import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cliPath = resolve(projectRoot, "dist/cli.js");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function runInstalledVersion(packageMetadata: {
  name: string;
  version: string;
}) {
  const installedRoot = mkdtempSync(join(tmpdir(), "oss-evidence-version-"));
  const installedDist = resolve(installedRoot, "dist");

  try {
    mkdirSync(installedDist);
    copyFileSync(cliPath, resolve(installedDist, "cli.js"));
    copyFileSync(
      resolve(projectRoot, "dist/version.js"),
      resolve(installedDist, "version.js"),
    );
    writeFileSync(
      resolve(installedRoot, "package.json"),
      `${JSON.stringify({ ...packageMetadata, type: "module" })}\n`,
    );

    return spawnSync(
      process.execPath,
      [resolve(installedDist, "cli.js"), "--version"],
      {
        cwd: installedRoot,
        encoding: "utf8",
      },
    );
  } finally {
    rmSync(installedRoot, { recursive: true, force: true });
  }
}

test("prints command help without standard-error output", () => {
  const result = spawnSync(process.execPath, [cliPath, "--help"], {
    cwd: projectRoot,
    encoding: "utf8",
  });

  assert.equal(result.status, 0);
  assert.match(
    result.stdout,
    /^Usage: oss-evidence collect owner\/repository --maintainer username$/m,
  );
  assert.equal(result.stderr, "");
});

test("prints the version from package metadata", () => {
  const packageMetadata = JSON.parse(
    readFileSync(resolve(projectRoot, "package.json"), "utf8"),
  ) as { version?: unknown };
  assert.equal(typeof packageMetadata.version, "string");

  const result = spawnSync(process.execPath, [cliPath, "--version"], {
    cwd: projectRoot,
    encoding: "utf8",
  });

  assert.equal(result.status, 0);
  assert.equal(result.stdout, `${packageMetadata.version}\n`);
  assert.equal(result.stderr, "");
});

test("reads a changed version from installed package metadata", () => {
  const version = "7.6.5-rc.1+build.9";
  const result = runInstalledVersion({ name: "oss-evidence", version });

  assert.equal(result.status, 0);
  assert.equal(result.stdout, `${version}\n`);
  assert.equal(result.stderr, "");
});

test("rejects invalid installed package metadata", () => {
  const invalidMetadata = [
    { name: "other-package", version: "1.2.3" },
    { name: "oss-evidence", version: "01.2.3" },
  ];

  for (const packageMetadata of invalidMetadata) {
    const result = runInstalledVersion(packageMetadata);

    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.notEqual(result.stderr, "");
  }
});

test("derives the archive filename from package metadata", () => {
  const packageMetadata = JSON.parse(
    readFileSync(resolve(projectRoot, "package.json"), "utf8"),
  ) as { name?: unknown; version?: unknown };
  assert.equal(typeof packageMetadata.name, "string");
  assert.equal(typeof packageMetadata.version, "string");

  const result = spawnSync(
    npmCommand,
    ["pack", "--dry-run", "--json", "--ignore-scripts"],
    {
      cwd: projectRoot,
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0, result.stderr);
  const packResults = JSON.parse(result.stdout) as Array<{
    filename?: unknown;
  }>;
  assert.equal(packResults.length, 1);
  assert.equal(
    packResults[0]?.filename,
    `${packageMetadata.name}-${packageMetadata.version}.tgz`,
  );
  assert.equal(packResults[0]?.filename, "oss-evidence-0.1.0.tgz");
});

test("rejects unsupported invocations with exit code 2", () => {
  const unsupportedArguments = [
    [],
    ["collect"],
    ["--unknown"],
    ["--help", "--version"],
    ["--help", "--help"],
  ];

  for (const args of unsupportedArguments) {
    const result = spawnSync(process.execPath, [cliPath, ...args], {
      cwd: projectRoot,
      encoding: "utf8",
    });

    assert.equal(
      result.status,
      2,
      `expected ${JSON.stringify(args)} to be rejected`,
    );
    assert.equal(result.stdout, "");
    assert.notEqual(result.stderr, "");
  }
});

test("compiler scripts remove stale output", () => {
  const staleBuildOutput = resolve(projectRoot, "dist/stale.js");
  const staleTestOutput = resolve(projectRoot, ".test-dist/stale.js");
  writeFileSync(staleBuildOutput, "stale build output\n");
  writeFileSync(staleTestOutput, "stale test output\n");

  try {
    const buildResult = spawnSync(npmCommand, ["run", "build"], {
      cwd: projectRoot,
      encoding: "utf8",
    });
    assert.equal(buildResult.status, 0, buildResult.stderr);
    assert.equal(existsSync(staleBuildOutput), false);
    assert.equal(existsSync(staleTestOutput), false);
  } finally {
    rmSync(staleBuildOutput, { force: true });
    rmSync(staleTestOutput, { force: true });
  }
});
