import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
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

import { runNpm } from "./helpers/npm.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cliPath = resolve(projectRoot, "dist/cli.js");

function runInstalledVersion(packageFile: Record<string, unknown> | string) {
  const installedRoot = mkdtempSync(join(tmpdir(), "oss-evidence-version-"));
  const installedDist = resolve(installedRoot, "dist");

  try {
    mkdirSync(installedDist);
    copyFileSync(cliPath, resolve(installedDist, "cli.js"));
    copyFileSync(
      resolve(projectRoot, "dist/version.js"),
      resolve(installedDist, "version.js"),
    );
    copyFileSync(
      resolve(projectRoot, "dist/package.json"),
      resolve(installedDist, "package.json"),
    );
    writeFileSync(
      resolve(installedRoot, "package.json"),
      typeof packageFile === "string"
        ? packageFile
        : `${JSON.stringify(packageFile)}\n`,
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
  assert.match(result.stdout, /^ {7}oss-evidence verify <report.json>$/m);
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

test("build emits a version-free ESM boundary", () => {
  const distPackageMetadata: unknown = JSON.parse(
    readFileSync(resolve(projectRoot, "dist/package.json"), "utf8"),
  );

  assert.deepEqual(distPackageMetadata, { type: "module" });
});

test("reads a changed version from installed package metadata", () => {
  const version = "7.6.5-rc.1+build.9";
  const result = runInstalledVersion({ name: "oss-evidence", version });

  assert.equal(result.status, 0);
  assert.equal(result.stdout, `${version}\n`);
  assert.equal(result.stderr, "");
});

test("rejects invalid installed package metadata", () => {
  const invalidPackageFiles: Array<{
    label: string;
    packageFile: Record<string, unknown> | string;
  }> = [
    {
      label: "wrong package name",
      packageFile: { name: "other-package", version: "1.2.3" },
    },
    {
      label: "numeric version",
      packageFile: { name: "oss-evidence", version: 123 },
    },
    {
      label: "missing version",
      packageFile: { name: "oss-evidence" },
    },
    {
      label: "invalid JSON",
      packageFile: "{invalid-json",
    },
    {
      label: "leading-zero SemVer",
      packageFile: { name: "oss-evidence", version: "01.2.3" },
    },
  ];

  for (const { label, packageFile } of invalidPackageFiles) {
    const result = runInstalledVersion(packageFile);

    assert.equal(result.status, 1, label);
    assert.equal(result.stdout, "");
    assert.equal(
      result.stderr,
      "Unable to read package metadata. Reinstall oss-evidence.\n",
    );
  }
});

test("derives the archive filename from package metadata", () => {
  const packageMetadata = JSON.parse(
    readFileSync(resolve(projectRoot, "package.json"), "utf8"),
  ) as { name?: unknown; version?: unknown };
  assert.equal(typeof packageMetadata.name, "string");
  assert.equal(typeof packageMetadata.version, "string");

  const result = runNpm(
    ["pack", "--dry-run", "--json", "--ignore-scripts"],
    projectRoot,
  );

  assert.equal(result.status, 0, result.stderr);
  const packResults = JSON.parse(result.stdout) as Array<{
    filename?: unknown;
    files?: Array<{ path?: unknown }>;
  }>;
  assert.equal(packResults.length, 1);
  assert.equal(
    packResults[0]?.filename,
    `${packageMetadata.name}-${packageMetadata.version}.tgz`,
  );
  assert.equal(packResults[0]?.filename, "oss-evidence-0.3.0.tgz");
  assert.ok(
    packResults[0]?.files?.some(({ path }) => path === "dist/package.json"),
  );
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
