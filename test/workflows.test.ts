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
  const approvedActions = new Set([
    "actions/checkout@v6",
    "actions/setup-node@v6",
    "actions/dependency-review-action@v5",
    "actions/attest-build-provenance@v4",
    "actions/upload-artifact@v7",
  ]);
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

test("workflow CI covers supported Node versions and every local quality gate", () => {
  const workflow = readWorkflow("ci.yml");
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /push:/);
  assert.match(workflow, /node-version:\s*\[22, 24]/);
  assert.match(workflow, /actions\/checkout@v6/);
  assert.match(workflow, /actions\/setup-node@v6/);
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
  assert.match(workflow, /actions\/checkout@v6/);
  assert.match(workflow, /actions\/dependency-review-action@v5/);
});

test("workflow release artifacts are tag-triggered, attested, and not published", () => {
  const workflow = readWorkflow("release-artifacts.yml");
  assert.match(workflow, /tags:\n\s+- "v\*"/);
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /attestations: write/);
  assert.match(workflow, /actions\/attest-build-provenance@v4/);
  assert.match(workflow, /actions\/upload-artifact@v7/);
  assert.match(workflow, /\.tgz\.sha256/);
  assert.match(
    workflow,
    /test "v\$\{PACKAGE_VERSION}" = "\$\{GITHUB_REF_NAME}"/,
  );
  assert.doesNotMatch(workflow, /packages: write|contents: write/);
});
