import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const validator = resolve(
  projectRoot,
  "scripts/validate-ecosystem-evidence.mjs",
);

const validLedger = {
  schemaVersion: "1.0",
  asOf: "2026-07-20",
  sources: [
    {
      id: "chaoss-starter-health",
      title: "Starter Project Health Metrics Model",
      publisher: "CHAOSS",
      url: "https://www.chaoss.community/starter-project-health-metrics-model/",
      publishedAt: "2023-04-13",
      accessedAt: "2026-07-20",
      sourceType: "official-documentation",
      reviewStatus: "not-applicable",
    },
  ],
  claims: [
    {
      id: "project-health-measurement",
      statement:
        "CHAOSS publishes a starter model for measuring project health.",
      sourceIds: ["chaoss-starter-health"],
      theme: "measurement",
      projectRelevance: "The tool exposes a subset of related public activity.",
      limitations: ["The tool does not implement or certify the CHAOSS model."],
    },
  ],
  capabilityMappings: [
    {
      evidenceType: "release",
      claimIds: ["project-health-measurement"],
      coverage: "partial",
      implementationEvidence: [
        "src/domain/report.ts",
        "src/render/markdown.ts",
      ],
      notes: "A release list is not a release-frequency assessment.",
    },
  ],
};

function runLedger(value: unknown) {
  const root = mkdtempSync(resolve(tmpdir(), "oss-evidence-ledger-"));
  const file = resolve(root, "ledger.json");
  writeFileSync(file, `${JSON.stringify(value)}\n`, { mode: 0o600 });
  const result = spawnSync(process.execPath, [validator, "--file", file], {
    cwd: projectRoot,
    encoding: "utf8",
    env: {},
  });
  rmSync(root, { recursive: true, force: true });
  return result;
}

test("ecosystem ledger validator accepts a strict reviewed ledger", () => {
  const result = runLedger(validLedger);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /1 source, 1 claim, 1 capability mapping/);
  assert.equal(result.stderr, "");
});

test("ecosystem ledger validator rejects unknown fields and invalid enums", () => {
  const invalid = structuredClone(validLedger);
  Object.assign(invalid.sources[0], {
    unexpected: true,
    reviewStatus: "likely",
  });
  const result = runLedger(invalid);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /^Ecosystem evidence validation failed:/);
});

test("ecosystem ledger validator rejects duplicate and missing references", () => {
  const invalid = structuredClone(validLedger);
  invalid.sources.push(structuredClone(invalid.sources[0]));
  invalid.claims[0].sourceIds = ["missing-source"];
  const result = runLedger(invalid);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /duplicate source id|unknown source id/);
});

test("ecosystem ledger validator rejects unreviewed URLs and empty limits", () => {
  const invalid = structuredClone(validLedger);
  invalid.sources[0].url = "http://example.com/source";
  invalid.claims[0].limitations = [];
  const result = runLedger(invalid);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /reviewed source URL|limitations/);
});

test("ecosystem ledger validator requires relative real repository files", () => {
  for (const evidence of [
    resolve(projectRoot, "src/domain/report.ts"),
    "../outside-repository.md",
    "src/not-a-real-file.ts",
    "node_modules/.bin/biome",
  ]) {
    const invalid = structuredClone(validLedger);
    invalid.capabilityMappings[0].implementationEvidence = [evidence];
    const result = runLedger(invalid);
    assert.equal(result.status, 1, evidence);
    assert.match(result.stderr, /implementation evidence/, evidence);
  }
});

test("committed ecosystem evidence ledger passes offline validation", () => {
  const result = spawnSync(process.execPath, [validator], {
    cwd: projectRoot,
    encoding: "utf8",
    env: {},
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /source.*claim.*capability mapping/);
  assert.equal(result.stderr, "");
});
