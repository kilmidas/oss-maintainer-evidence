import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { readReportJson } from "../src/io/report-input.js";
import { InputError } from "../src/errors.js";

const withTempDirectory = async (
  run: (directory: string) => Promise<void>,
): Promise<void> => {
  const directory = mkdtempSync(join(tmpdir(), "oss-evidence-input-"));
  try {
    await run(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

test("report input reads valid JSON", async () => {
  await withTempDirectory(async (directory) => {
    const path = join(directory, "report.json");
    writeFileSync(path, '{"schemaVersion":"1.0"}\n');

    assert.deepEqual(await readReportJson(path), { schemaVersion: "1.0" });
  });
});

test("report input rejects invalid JSON and invalid UTF-8", async () => {
  await withTempDirectory(async (directory) => {
    const invalidJson = join(directory, "invalid.json");
    writeFileSync(invalidJson, "{invalid");
    await assert.rejects(() => readReportJson(invalidJson), InputError);

    const invalidUtf8 = join(directory, "invalid-utf8.json");
    writeFileSync(invalidUtf8, Buffer.from([0x7b, 0xff, 0x7d]));
    await assert.rejects(() => readReportJson(invalidUtf8), InputError);
  });
});

test("report input rejects missing files and directories", async () => {
  await withTempDirectory(async (directory) => {
    await assert.rejects(
      () => readReportJson(join(directory, "missing.json")),
      InputError,
    );
    const nested = join(directory, "nested");
    mkdirSync(nested);
    await assert.rejects(() => readReportJson(nested), InputError);
  });
});

test("report input rejects content larger than 5 MiB", async () => {
  await withTempDirectory(async (directory) => {
    const path = join(directory, "large.json");
    writeFileSync(path, Buffer.alloc(5 * 1024 * 1024 + 1, 0x20));

    await assert.rejects(
      () => readReportJson(path),
      (error: unknown) =>
        error instanceof InputError && /5 MiB/.test(error.message),
    );
  });
});
