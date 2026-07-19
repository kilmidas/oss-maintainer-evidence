import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
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
  "dependency-review.yml",
  "release-artifacts.yml",
] as const;
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
