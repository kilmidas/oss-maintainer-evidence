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
import { basename, dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { resolveNpmExecPath } from "./helpers/npm.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

test("requires an existing npm CLI entry point", () => {
  assert.throws(() => resolveNpmExecPath(undefined), /npm_execpath is missing/);
  assert.throws(
    () => resolveNpmExecPath(resolve(projectRoot, "not-npm.js")),
    /existing npm-cli\.js/,
  );

  const npmExecPath = resolveNpmExecPath(process.env.npm_execpath);
  assert.equal(basename(npmExecPath), "npm-cli.js");
});

test("clean script removes only isolated compiler output", () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "oss-evidence-clean-"));
  const scriptsDirectory = resolve(temporaryRoot, "scripts");
  const copiedCleanScript = resolve(scriptsDirectory, "clean.mjs");
  const staleBuildOutput = resolve(temporaryRoot, "dist/stale.js");
  const staleTestOutput = resolve(temporaryRoot, ".test-dist/stale.js");
  const protectedOutput = resolve(temporaryRoot, "keep.txt");

  try {
    mkdirSync(resolve(temporaryRoot, "dist"));
    mkdirSync(resolve(temporaryRoot, ".test-dist"));
    mkdirSync(scriptsDirectory);
    copyFileSync(resolve(projectRoot, "scripts/clean.mjs"), copiedCleanScript);
    writeFileSync(staleBuildOutput, "stale build output\n");
    writeFileSync(staleTestOutput, "stale test output\n");
    writeFileSync(protectedOutput, "keep\n");

    const result = spawnSync(process.execPath, [copiedCleanScript], {
      cwd: temporaryRoot,
      encoding: "utf8",
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "");
    assert.equal(existsSync(staleBuildOutput), false);
    assert.equal(existsSync(staleTestOutput), false);
    assert.equal(existsSync(protectedOutput), true);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("package verifier allows a cold npm cache to resolve dependencies", () => {
  const source = readFileSync(
    resolve(projectRoot, "scripts/verify-package.mjs"),
    "utf8",
  );

  assert.doesNotMatch(source, /["']--offline["']/);
});
