import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const script = resolve(projectRoot, "scripts/check-licenses.mjs");

test("license policy accepts every reviewed SPDX expression", () => {
  const fixture = makeFixture([
    { name: "mit-dependency", license: "MIT" },
    { name: "apache-dependency", license: "Apache-2.0" },
    { name: "dual-dependency", license: "MIT OR Apache-2.0" },
  ]);
  try {
    const result = runLicenseCheck(fixture);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /mit-dependency@1\.0\.0: MIT/);
    assert.match(result.stdout, /apache-dependency@1\.0\.0: Apache-2\.0/);
    assert.match(result.stdout, /dual-dependency@1\.0\.0: MIT OR Apache-2\.0/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("license policy rejects missing, unknown, incompatible, and unapproved licenses", () => {
  for (const license of [undefined, "UNKNOWN", "GPL-3.0-only", "ISC"]) {
    const fixture = makeFixture([{ name: "blocked-dependency", license }]);
    try {
      const result = runLicenseCheck(fixture);
      assert.equal(result.status, 1, String(license));
      assert.match(result.stderr, /blocked-dependency@1\.0\.0/);
      assert.match(result.stderr, /missing or unapproved license/i);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  }
});

function runLicenseCheck(root: string) {
  if (!existsSync(script)) {
    return { status: 1, stdout: "", stderr: "license checker missing" };
  }
  return spawnSync(process.execPath, [script, "--root", root], {
    encoding: "utf8",
  });
}

function makeFixture(
  dependencies: Array<{ name: string; license: string | undefined }>,
): string {
  const root = mkdtempSync(join(tmpdir(), "oss-evidence-licenses-"));
  const packages: Record<string, object> = { "": { name: "fixture" } };
  for (const dependency of dependencies) {
    const path = `node_modules/${dependency.name}`;
    const directory = join(root, path);
    mkdirSync(directory, { recursive: true });
    const metadata: Record<string, string> = {
      name: dependency.name,
      version: "1.0.0",
    };
    if (dependency.license !== undefined) metadata.license = dependency.license;
    writeFileSync(join(directory, "package.json"), JSON.stringify(metadata));
    packages[path] = { version: "1.0.0" };
  }
  writeFileSync(
    join(root, "package-lock.json"),
    JSON.stringify({ lockfileVersion: 3, packages }),
  );
  return root;
}
