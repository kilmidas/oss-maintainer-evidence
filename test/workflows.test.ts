import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
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
const workflowPath = (name: string) =>
  resolve(projectRoot, `.github/workflows/${name}`);
const readWorkflow = (name: string) =>
  existsSync(workflowPath(name))
    ? readFileSync(workflowPath(name), "utf8")
    : "";
const workflowNames = [
  "ci.yml",
  "collect-evidence.yml",
  "dependency-review.yml",
  "evidence-smoke.yml",
  "release-artifacts.yml",
] as const;
const localEvidenceWorkflow =
  "./.github/workflows/collect-evidence.yml" as const;
const pinnedActions = {
  checkout: "actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0",
  setupNode: "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
  dependencyReview:
    "actions/dependency-review-action@a1d282b36b6f3519aa1f3fc636f609c47dddb294",
  attestBuildProvenance:
    "actions/attest-build-provenance@0f67c3f4856b2e3261c31976d6725780e5e4c373",
  uploadArtifact:
    "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a",
} as const;

test("workflow policy includes required automation files", () => {
  for (const name of workflowNames) {
    assert.equal(existsSync(workflowPath(name)), true, name);
  }
  assert.equal(
    existsSync(resolve(projectRoot, ".github/dependabot.yml")),
    true,
  );
  assert.equal(existsSync(resolve(projectRoot, ".github/release.yml")), true);
});

test("workflow policy keeps default permissions read-only and avoids unsafe triggers", () => {
  const approvedActions: ReadonlySet<string> = new Set(
    Object.values(pinnedActions),
  );
  for (const name of workflowNames) {
    const workflow = readWorkflow(name);
    assert.match(workflow, /^permissions:\n {2}contents: read$/m, name);
    assert.doesNotMatch(workflow, /pull_request_target|curl\s|wget\s/i, name);
    assert.doesNotMatch(
      workflow,
      /npm\s+(?:publish|adduser|login)|gh\s+release\s+create/i,
      name,
    );
    for (const action of workflow.matchAll(/uses:\s+([^\s]+)/g)) {
      if (action[1] === localEvidenceWorkflow) continue;
      assert.equal(
        approvedActions.has(action[1]),
        true,
        `${name}: ${action[1]}`,
      );
    }
  }
});

test("workflow actions are pinned to immutable commits", () => {
  for (const name of workflowNames) {
    const workflow = readWorkflow(name);
    for (const action of workflow.matchAll(/uses:\s+([^\s]+)/g)) {
      if (action[1] === localEvidenceWorkflow) continue;
      assert.match(
        action[1],
        /^[a-z0-9_.-]+\/[a-z0-9_.-]+@[0-9a-f]{40}$/,
        `${name}: ${action[1]}`,
      );
    }
  }
});

test("workflow CI covers supported Node versions and every local quality gate", () => {
  const workflow = readWorkflow("ci.yml");
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /push:/);
  assert.match(workflow, /node-version:\s*\[22, 24]/);
  assert.ok(workflow.includes(pinnedActions.checkout));
  assert.ok(workflow.includes(pinnedActions.setupNode));
  for (const command of [
    "npm ci",
    "npm run schema:check",
    "npm run check",
    "npm audit --omit=dev",
    "npm run license:check",
    "npm run package:verify",
  ]) {
    assert.ok(workflow.includes(`run: ${command}`), command);
  }
});

test("workflow dependency review runs only for pull requests with official actions", () => {
  const workflow = readWorkflow("dependency-review.yml");
  assert.match(workflow, /on:\n {2}pull_request:/);
  assert.doesNotMatch(workflow, /\n {2}push:/);
  assert.ok(workflow.includes(pinnedActions.checkout));
  assert.ok(workflow.includes(pinnedActions.dependencyReview));
});

test("workflow release artifacts are tag-triggered, attested, and not published", () => {
  const workflow = readWorkflow("release-artifacts.yml");
  assert.match(workflow, /tags:\n\s+- "v\*"/);
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /attestations: write/);
  assert.ok(workflow.includes(pinnedActions.attestBuildProvenance));
  assert.ok(workflow.includes(pinnedActions.uploadArtifact));
  assert.match(workflow, /\.tgz\.sha256/);
  assert.match(
    workflow,
    /test "v\$\{PACKAGE_VERSION}" = "\$\{GITHUB_REF_NAME}"/,
  );
  assert.doesNotMatch(workflow, /packages: write|contents: write/);
});

test("reusable evidence workflow checks out only its immutable definition source", () => {
  const workflow = readWorkflow("collect-evidence.yml");
  assert.match(workflow, /^on:\n {2}workflow_call:/m);
  assert.match(workflow, /^permissions:\n {2}contents: read$/m);
  assert.match(
    workflow,
    /jobs:\n {2}collect:\n(?:.|\n)*?permissions:\n {6}contents: read/,
  );
  assert.ok(workflow.includes(pinnedActions.checkout));
  assert.ok(workflow.includes(pinnedActions.setupNode));
  assert.ok(workflow.includes(pinnedActions.uploadArtifact));
  assert.match(workflow, /repository: \$\{\{ job\.workflow_repository \}\}/);
  assert.match(workflow, /ref: \$\{\{ job\.workflow_sha \}\}/);
  assert.match(workflow, /path: _oss-maintainer-evidence/);
  assert.match(workflow, /persist-credentials: false/);
  assert.doesNotMatch(workflow, /repository: \$\{\{ github\.repository \}\}/);
  assert.doesNotMatch(workflow, /\n\s+secrets:/);
  assert.doesNotMatch(workflow, /\$\{\{\s*secrets\./);
});

test("reusable evidence workflow scopes inputs and authentication to collection", () => {
  const workflow = readWorkflow("collect-evidence.yml");
  const collection = workflowStep(workflow, "Collect public evidence");
  const verification = workflowStep(workflow, "Verify evidence signed out");
  const collectionRun = workflowRunBlock(workflow, "Collect public evidence");
  const verificationRun = workflowRunBlock(
    workflow,
    "Verify evidence signed out",
  );

  assert.equal(count(workflow, `GH_TOKEN: \${{ github.token }}`), 1);
  assert.match(collection, /GH_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(collection, /TARGET_REPOSITORY: \$\{\{ inputs\.repository \}\}/);
  assert.match(collection, /TARGET_MAINTAINER: \$\{\{ inputs\.maintainer \}\}/);
  assert.match(collection, /EVIDENCE_SINCE: \$\{\{ inputs\.since \}\}/);
  assert.match(collection, /MAX_ITEMS: \$\{\{ inputs\.max_items \}\}/);
  assert.doesNotMatch(collectionRun, /\$\{\{\s*inputs\./);
  assert.match(verification, /GH_TOKEN: ""/);
  assert.match(verification, /GITHUB_TOKEN: ""/);
  assert.doesNotMatch(verification, /github\.token|inputs\./);

  for (const variable of [
    "TARGET_REPOSITORY",
    "TARGET_MAINTAINER",
    "EVIDENCE_SINCE",
    "MAX_ITEMS",
    "REPORT_PATH",
  ]) {
    assert.ok(collectionRun.includes(`"$${variable}"`), variable);
  }
  assert.match(collectionRun, /status=0\nset \+e\n/);
  assert.match(collectionRun, /\|\| status=\$\?\nset -e\n/);
  assert.match(collectionRun, /case "\$status" in\n {2}0\|4\) ;;/);
  assert.match(collectionRun, /\*\) exit "\$status" ;;/);
  assert.match(collectionRun, /test -s "\$REPORT_PATH"/);
  assert.match(verificationRun, /^set -o pipefail$/m);
  assert.match(
    verificationRun,
    /verify "\$REPORT_PATH" 2>&1 \| tee "\$VERIFICATION_PATH"/,
  );
});

test("reusable evidence collection keeps hostile input in single arguments", () => {
  const workflow = readWorkflow("collect-evidence.yml");
  const run = workflowRunBlock(workflow, "Collect public evidence");
  const target = "owner/repo with space;$(touch escaped)\nnext";
  const maintainer = "name'\"$(touch quoted)";
  const since = "2026-01-01T00:00:00Z $(touch since)";
  const result = runWorkflowShell(run, {
    TARGET_REPOSITORY: target,
    TARGET_MAINTAINER: maintainer,
    EVIDENCE_SINCE: since,
    MAX_ITEMS: "200",
    FAKE_EXIT: "0",
    FAKE_WRITE_REPORT: "1",
  });

  try {
    assert.equal(result.status, 0, result.stderr);
    const args = JSON.parse(
      readFileSync(result.capturePath, "utf8"),
    ) as string[];
    assert.deepEqual(args, [
      "dist/cli.js",
      "collect",
      target,
      "--maintainer",
      maintainer,
      "--since",
      since,
      "--max-items",
      "200",
      "--format",
      "json",
      "--output",
      result.reportPath,
    ]);
    for (const marker of ["escaped", "quoted", "since"]) {
      assert.equal(existsSync(resolve(result.root, marker)), false, marker);
    }
  } finally {
    rmSync(result.root, { recursive: true, force: true });
  }
});

test("reusable evidence collection accepts only complete or partial reports", () => {
  const run = workflowRunBlock(
    readWorkflow("collect-evidence.yml"),
    "Collect public evidence",
  );
  for (const [exitCode, writeReport, expected] of [
    [0, true, 0],
    [4, true, 0],
    [3, true, 3],
    [0, false, 1],
  ] as const) {
    const result = runWorkflowShell(run, {
      FAKE_EXIT: String(exitCode),
      FAKE_WRITE_REPORT: writeReport ? "1" : "0",
    });
    try {
      assert.equal(
        result.status,
        expected,
        `exit ${exitCode}, write ${writeReport}: ${result.stderr}`,
      );
    } finally {
      rmSync(result.root, { recursive: true, force: true });
    }
  }
});

test("reusable evidence verification retains failure output and upload diagnostics", () => {
  const workflow = readWorkflow("collect-evidence.yml");
  const run = workflowRunBlock(workflow, "Verify evidence signed out");
  const result = runWorkflowShell(run, {
    FAKE_EXIT: "6",
    FAKE_WRITE_REPORT: "0",
  });
  try {
    assert.equal(result.status, 6);
    assert.equal(
      readFileSync(result.verificationPath, "utf8"),
      "verification stdout\nverification stderr\n",
    );
  } finally {
    rmSync(result.root, { recursive: true, force: true });
  }

  const upload = workflowStep(workflow, "Upload evidence diagnostics");
  assert.match(upload, /if: \$\{\{ always\(\) \}\}/);
  assert.match(upload, /name: oss-maintainer-evidence/);
  assert.match(upload, /oss-evidence\.json/);
  assert.match(upload, /verification\.txt/);
  assert.match(upload, /if-no-files-found: warn/);
  assert.match(upload, /retention-days: 14/);
});

test("evidence smoke calls only the local reusable workflow on bounded triggers", () => {
  const workflow = readWorkflow("evidence-smoke.yml");
  assert.match(workflow, /^permissions:\n {2}contents: read$/m);
  assert.match(workflow, /^on:\n {2}workflow_dispatch:/m);
  assert.match(workflow, /\n {2}schedule:\n {4}- cron: "[^"]+"/);
  assert.doesNotMatch(
    workflow,
    /pull_request:|pull_request_target:|\n {2}push:/,
  );
  assert.equal(count(workflow, `uses: ${localEvidenceWorkflow}`), 1);
  assert.match(workflow, /repository: kilmidas\/oss-maintainer-evidence/);
  assert.match(workflow, /maintainer: kilmidas/);
  assert.match(workflow, /since: 90d/);
  assert.match(workflow, /max_items: 200/);
  assert.doesNotMatch(workflow, /\n\s+secrets:|\$\{\{\s*secrets\./);
});

function count(value: string, needle: string): number {
  return value.split(needle).length - 1;
}

function workflowStep(workflow: string, stepName: string): string {
  const start = workflow.indexOf(`      - name: ${stepName}`);
  if (start === -1) return "";
  const end = workflow.indexOf("\n      - name:", start + 1);
  return workflow.slice(start, end === -1 ? undefined : end);
}

function workflowRunBlock(workflow: string, stepName: string): string {
  const step = workflowStep(workflow, stepName);
  const lines = step.split("\n");
  const runLine = lines.indexOf("        run: |");
  if (runLine === -1) return "";
  const body: string[] = [];
  for (const line of lines.slice(runLine + 1)) {
    if (line.length > 0 && !line.startsWith("          ")) break;
    body.push(line.startsWith("          ") ? line.slice(10) : "");
  }
  return body.join("\n").trimEnd();
}

function runWorkflowShell(
  shell: string,
  overrides: Record<string, string>,
): {
  root: string;
  capturePath: string;
  reportPath: string;
  verificationPath: string;
  status: number | null;
  stderr: string;
} {
  const root = mkdtempSync(join(tmpdir(), "oss-evidence-workflow-"));
  const bin = resolve(root, "bin");
  const fakeNode = resolve(bin, "node");
  const capturePath = resolve(root, "args.json");
  const reportPath = resolve(root, "oss-evidence.json");
  const verificationPath = resolve(root, "verification.txt");
  mkdirSync(bin);
  writeFileSync(
    fakeNode,
    `#!${process.execPath}\nconst { writeFileSync } = require("node:fs");\nwriteFileSync(process.env.CAPTURE_PATH, JSON.stringify(process.argv.slice(2)));\nif (process.argv.includes("collect") && process.env.FAKE_WRITE_REPORT === "1") writeFileSync(process.env.REPORT_PATH, "{}\\n");\nif (process.argv.includes("verify")) { process.stdout.write("verification stdout\\n"); process.stderr.write("verification stderr\\n"); }\nprocess.exit(Number(process.env.FAKE_EXIT || "0"));\n`,
  );
  chmodSync(fakeNode, 0o755);
  const result = spawnSync("bash", ["-e", "-c", shell], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH ?? ""}`,
      CAPTURE_PATH: capturePath,
      REPORT_PATH: reportPath,
      VERIFICATION_PATH: verificationPath,
      TARGET_REPOSITORY: "owner/repository",
      TARGET_MAINTAINER: "maintainer",
      EVIDENCE_SINCE: "90d",
      MAX_ITEMS: "200",
      ...overrides,
    },
  });
  return {
    root,
    capturePath,
    reportPath,
    verificationPath,
    status: result.status,
    stderr: result.stderr,
  };
}
