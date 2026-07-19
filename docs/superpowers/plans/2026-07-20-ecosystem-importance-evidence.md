# Ecosystem Importance Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish an auditable ecosystem-importance rationale whose claims, sources, current product coverage, and limitations can be checked offline.

**Architecture:** Add a strict machine-readable claim ledger and a read-only Node.js validator under `scripts/`. A concise Markdown page will paraphrase the validated claims, while documentation tests keep the narrative, ledger, README, and limitations page connected. Network reachability remains a manual publication check so transient publisher failures do not make normal CI nondeterministic.

**Tech Stack:** Node.js 22 ESM, Zod 4, TypeScript tests with `node:test`, Biome, Markdown, JSON

---

## File Structure

- Create `scripts/validate-ecosystem-evidence.mjs`: strict ledger schema,
  reviewed-source allowlist, cross-reference validation, and a read-only CLI.
- Create `test/ecosystem-evidence.test.ts`: process-level tests for valid and
  invalid ledgers plus the committed ledger.
- Create `docs/ecosystem-importance.sources.json`: canonical sources, narrow
  claims, and current capability mappings.
- Create `docs/ecosystem-importance.md`: human-readable rationale and source
  ledger.
- Modify `test/docs.test.ts`: require the new artifacts, enforce narrative to
  ledger coverage, and reject misleading claims.
- Modify `README.md`: link the ecosystem-importance page without claiming
  adoption or eligibility.
- Modify `docs/limitations.md`: distinguish ecosystem context from observed
  adoption and link to the rationale.
- Modify `package.json`: add `evidence:check` and include it in `check`.

Do not change the CLI report schema, collectors, renderers, package version,
changelog, release workflow, or public GitHub settings in this plan.

### Task 1: Add the Strict Offline Ledger Validator

**Files:**

- Create: `scripts/validate-ecosystem-evidence.mjs`
- Create: `test/ecosystem-evidence.test.ts`

- [ ] **Step 1: Write the failing validator tests**

Create a process-level test helper that writes only synthetic JSON to an
isolated temporary directory and runs the validator with `--file`:

```ts
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
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
      statement: "CHAOSS publishes a starter model for measuring project health.",
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
      implementationEvidence: ["src/domain/report.ts", "src/render/markdown.ts"],
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
  Object.assign(invalid.sources[0], { unexpected: true, reviewStatus: "likely" });
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
```

- [ ] **Step 2: Run the focused test and observe the intended failure**

Run:

```bash
npm run build
tsc -p tsconfig.test.json
node --test .test-dist/test/ecosystem-evidence.test.js
```

Expected: FAIL because `scripts/validate-ecosystem-evidence.mjs` does not exist.

- [ ] **Step 3: Implement the minimum strict validator**

Use Zod strict objects and exact enums:

```js
import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const realProjectRoot = realpathSync(projectRoot);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const nonEmpty = z.string().trim().min(1);
const reviewedUrls = new Set([
  "https://www.linuxfoundation.org/research/open-source-maintainers",
  "https://www.chaoss.community/starter-project-health-metrics-model/",
  "https://openssf.org/scorecard/",
  "https://arxiv.org/abs/2411.06027",
  "https://docs.github.com/en/rest/repos/repos#get-a-repository",
  "https://docs.github.com/en/rest/repos/repos#list-repository-contributors",
  "https://docs.github.com/en/rest/releases/releases#list-releases",
  "https://docs.github.com/en/rest/search/search#search-issues-and-pull-requests",
  "https://docs.github.com/en/rest/pulls/pulls#get-a-pull-request",
  "https://docs.github.com/en/rest/pulls/reviews#list-reviews-for-a-pull-request",
  "https://docs.github.com/en/rest/issues/issues#get-an-issue",
  "https://docs.github.com/en/rest/issues/comments#list-issue-comments-for-a-repository",
  "https://docs.github.com/en/rest/repos/contents#get-repository-content",
]);

const source = z
  .object({
    id: nonEmpty,
    title: nonEmpty,
    publisher: nonEmpty,
    url: z.string().url().refine((value) => reviewedUrls.has(value), {
      message: "source URL is not in the reviewed source URL set",
    }),
    publishedAt: date.optional(),
    accessedAt: date,
    sourceType: z.enum([
      "official-documentation",
      "official-research",
      "research-paper",
    ]),
    reviewStatus: z.enum([
      "peer-reviewed",
      "not-peer-reviewed",
      "not-applicable",
      "unknown",
    ]),
  })
  .strict();

const claim = z
  .object({
    id: nonEmpty,
    statement: nonEmpty,
    sourceIds: z.array(nonEmpty).min(1),
    theme: z.enum([
      "maintainer-role",
      "measurement",
      "automation",
      "funding-impact",
    ]),
    projectRelevance: nonEmpty,
    limitations: z.array(nonEmpty).min(1),
  })
  .strict();

const mapping = z
  .object({
    evidenceType: z.enum([
      "release",
      "authored_pull_request",
      "merged_pull_request",
      "review",
      "opened_issue",
      "closed_issue",
      "issue_comment",
      "repository",
      "community",
      "adoption",
      "evidence_urls",
    ]),
    claimIds: z.array(nonEmpty).min(1),
    coverage: z.enum(["direct", "partial", "context-only"]),
    implementationEvidence: z.array(nonEmpty).min(1),
    notes: nonEmpty,
  })
  .strict();

const ledgerSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    asOf: date,
    sources: z.array(source).min(1),
    claims: z.array(claim).min(1),
    capabilityMappings: z.array(mapping).min(1),
  })
  .strict();

const duplicate = (values) => {
  const seen = new Set();
  return values.find((value) => seen.has(value) || !seen.add(value));
};

export function validateLedger(value) {
  const ledger = ledgerSchema.parse(value);
  const duplicateSource = duplicate(ledger.sources.map(({ id }) => id));
  if (duplicateSource) throw new Error(`duplicate source id: ${duplicateSource}`);
  const duplicateClaim = duplicate(ledger.claims.map(({ id }) => id));
  if (duplicateClaim) throw new Error(`duplicate claim id: ${duplicateClaim}`);
  const sourceIds = new Set(ledger.sources.map(({ id }) => id));
  const claimIds = new Set(ledger.claims.map(({ id }) => id));
  for (const entry of ledger.claims) {
    for (const id of entry.sourceIds) {
      if (!sourceIds.has(id)) throw new Error(`unknown source id: ${id}`);
    }
  }
  for (const entry of ledger.capabilityMappings) {
    for (const id of entry.claimIds) {
      if (!claimIds.has(id)) throw new Error(`unknown claim id: ${id}`);
    }
    for (const evidence of entry.implementationEvidence) {
      if (isAbsolute(evidence)) {
        throw new Error(`invalid implementation evidence: ${evidence}`);
      }
      const absolute = resolve(projectRoot, evidence);
      const fromRoot = relative(projectRoot, absolute);
      const lexicallyEscapesRoot =
        fromRoot === ".." ||
        fromRoot.startsWith(`..${sep}`) ||
        isAbsolute(fromRoot);
      if (
        lexicallyEscapesRoot ||
        fromRoot.length === 0 ||
        !existsSync(absolute)
      ) {
        throw new Error(`invalid implementation evidence: ${evidence}`);
      }
      const metadata = lstatSync(absolute);
      const real = realpathSync(absolute);
      const realFromRoot = relative(realProjectRoot, real);
      const reallyEscapesRoot =
        realFromRoot === ".." ||
        realFromRoot.startsWith(`..${sep}`) ||
        isAbsolute(realFromRoot);
      if (
        metadata.isSymbolicLink() ||
        !metadata.isFile() ||
        reallyEscapesRoot
      ) {
        throw new Error(`invalid implementation evidence: ${evidence}`);
      }
    }
  }
  return ledger;
}

function main() {
  const args = process.argv.slice(2);
  const file =
    args.length === 0
      ? resolve(projectRoot, "docs/ecosystem-importance.sources.json")
      : args.length === 2 && args[0] === "--file"
        ? resolve(args[1])
        : null;
  if (!file) throw new Error("usage: validate-ecosystem-evidence.mjs [--file PATH]");
  const ledger = validateLedger(JSON.parse(readFileSync(file, "utf8")));
  process.stdout.write(
    `${ledger.sources.length} source, ${ledger.claims.length} claim, ` +
      `${ledger.capabilityMappings.length} capability mapping\n`,
  );
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : "unknown error";
  process.stderr.write(`Ecosystem evidence validation failed: ${message}\n`);
  process.exitCode = 1;
}
```

Keep this script read-only: no network calls, environment-variable inspection,
subprocesses, or file writes.

- [ ] **Step 4: Run the focused test and verify it passes**

Run the Step 2 commands again.

Expected: 5 tests pass, 0 fail.

- [ ] **Step 5: Run focused static checks**

Run:

```bash
npx biome check scripts/validate-ecosystem-evidence.mjs test/ecosystem-evidence.test.ts
npm run typecheck
```

Expected: both commands exit 0 without fixes.

- [ ] **Step 6: Commit the validator**

```bash
git add scripts/validate-ecosystem-evidence.mjs test/ecosystem-evidence.test.ts
git commit -m "test: validate ecosystem evidence ledger"
```

### Task 2: Add the Reviewed Claim Ledger

**Files:**

- Create: `docs/ecosystem-importance.sources.json`
- Modify: `test/ecosystem-evidence.test.ts`

- [ ] **Step 1: Add a failing test for the committed ledger**

Append:

```ts
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
```

- [ ] **Step 2: Run the focused test and observe the intended failure**

Run the Task 1 focused test command.

Expected: the new test fails because
`docs/ecosystem-importance.sources.json` does not exist.

- [ ] **Step 3: Create the ledger with narrow claims**

Create the JSON using the exact schema from Task 1. Include these source IDs:

```text
lf-open-source-maintainers
chaoss-starter-project-health
openssf-scorecard
oss-funding-impact-toolkit
github-repository
github-contributors
github-releases
github-search-issues-pulls
github-pull-detail
github-pull-reviews
github-issue-detail
github-issue-comments
github-repository-content
```

Use these claim IDs and boundaries:

```text
maintainer-practices
  Source: lf-open-source-maintainers
  Claim: the qualitative study records transparency, formal documentation,
  and regular funding among practices shared by interviewed maintainers.
  Limit: the interview sample does not establish population prevalence.

project-health-measurement
  Source: chaoss-starter-project-health
  Claim: CHAOSS presents response time, change-request closure ratio,
  contributor concentration, and release frequency as starter health metrics.
  Limit: oss-evidence exposes only partial inputs and is not a CHAOSS model.

automated-inspectable-signals
  Source: openssf-scorecard
  Claim: OpenSSF Scorecard automates inspectable security-practice signals to
  help users evaluate project risk and posture.
  Limit: security scoring and maintenance evidence are different domains.

funding-impact-measurement-gap
  Source: oss-funding-impact-toolkit
  Claim: the paper reports a lack of consensus on meaningful measurement of
  public OSS funding impact and recommends context-aware methods.
  Limit: the paper's review status is unknown and oss-evidence does not measure
  funding impact.

public-github-provenance
  Sources: all narrow GitHub documentation entries
  Claim: GitHub documents public repository, release, issue, pull-request,
  review, comment, contributor, and content endpoints that correspond to the
  tool's observable evidence families.
  Limit: API availability does not make an activity important or complete.
```

Map all 11 allowed evidence types. Use `partial` for releases, issue work,
pull-request work, reviews, and visible contributors; use `context-only` for
community-file presence and adoption proxies; use `direct` only for repository
field provenance and source-linked record provenance. Each mapping must point to
specific current paths such as `src/domain/report.ts`,
`src/github/collect-repository.ts`, `src/github/collect-issues.ts`,
`src/github/collect-pulls.ts`, `src/render/markdown.ts`,
`docs/attribution.md`, or `examples/oss-maintainer-evidence.md`.

- [ ] **Step 4: Run the validator tests and inspect its summary**

Run:

```bash
npm run build
tsc -p tsconfig.test.json
node --test .test-dist/test/ecosystem-evidence.test.js
node scripts/validate-ecosystem-evidence.mjs
```

Expected: all focused tests pass; the final command reports 13 sources, 5
claims, and 11 capability mappings.

- [ ] **Step 5: Commit the reviewed ledger**

```bash
git add docs/ecosystem-importance.sources.json test/ecosystem-evidence.test.ts
git commit -m "docs: add ecosystem evidence ledger"
```

### Task 3: Publish the Human-Readable Rationale

**Files:**

- Create: `docs/ecosystem-importance.md`
- Modify: `test/docs.test.ts`

- [ ] **Step 1: Add failing narrative consistency tests**

Add both new files to `requiredFiles`, then add:

```ts
test("ecosystem importance narrative covers every ledger claim and source", () => {
  const narrative = read("docs/ecosystem-importance.md");
  const ledger = JSON.parse(
    read("docs/ecosystem-importance.sources.json"),
  ) as {
    claims: Array<{ id: string }>;
    sources: Array<{ id: string }>;
  };
  for (const { id } of [...ledger.claims, ...ledger.sources]) {
    assert.match(narrative, new RegExp(`\\b${escapeRegex(id)}\\b`), id);
  }
});

test("ecosystem importance narrative rejects adoption and endorsement claims", () => {
  const narrative = read("docs/ecosystem-importance.md");
  assert.match(narrative, /does not demonstrate external adoption/i);
  assert.match(narrative, /does not implement or certify the CHAOSS model/i);
  assert.match(narrative, /does not assess OpenSSF security posture/i);
  assert.doesNotMatch(narrative, /endorsed by|certified by|widely adopted/i);
  assert.doesNotMatch(narrative, /guarantees? (?:funding|eligibility|acceptance)/i);
});
```

- [ ] **Step 2: Run the documentation test and observe the intended failure**

Run:

```bash
npm run build
tsc -p tsconfig.test.json
node --test .test-dist/test/docs.test.js
```

Expected: FAIL because `docs/ecosystem-importance.md` does not exist.

- [ ] **Step 3: Write the source-linked narrative**

Create these sections:

```markdown
# Why Verifiable Maintainer Evidence Matters

As of 2026-07-20, this page explains the ecosystem problem that
OSS Maintainer Evidence is intended to address. It documents context, not
external adoption or program eligibility.

## Maintainer work needs traceable context
## Project-health measurement is established but contextual
## Automation can reduce evidence assembly work
## Funding impact remains difficult to measure
## What OSS Maintainer Evidence contributes
## What the current release does not establish
## Claim ledger
## Sources
```

For every substantive sentence, paraphrase only the narrow statement in the JSON
ledger and cite the corresponding canonical source. Include the stable claim and
source IDs in the claim-ledger tables. State all of the following verbatim:

```text
This page does not demonstrate external adoption.
OSS Maintainer Evidence does not implement or certify the CHAOSS model.
OSS Maintainer Evidence does not assess OpenSSF security posture.
Repository activity alone does not establish social, economic, security, or
funding impact.
```

Do not add numeric ecosystem-scale claims, acceptance predictions, long quotes,
or claims about the repository's popularity.

- [ ] **Step 4: Run the focused documentation and ledger tests**

Run:

```bash
npm run build
tsc -p tsconfig.test.json
node --test .test-dist/test/docs.test.js .test-dist/test/ecosystem-evidence.test.js
```

Expected: all focused tests pass.

- [ ] **Step 5: Commit the narrative**

```bash
git add docs/ecosystem-importance.md test/docs.test.ts
git commit -m "docs: explain ecosystem importance"
```

### Task 4: Connect the Evidence to Public Documentation and CI

**Files:**

- Modify: `README.md`
- Modify: `docs/limitations.md`
- Modify: `package.json`
- Modify: `test/docs.test.ts`

- [ ] **Step 1: Add failing link and script assertions**

Append:

```ts
test("public documentation links the ecosystem evidence without overclaiming", () => {
  const readme = read("README.md");
  const limitations = read("docs/limitations.md");
  assert.match(readme, /\[Ecosystem importance evidence]\(docs\/ecosystem-importance\.md\)/);
  assert.match(limitations, /\[ecosystem importance evidence]\(ecosystem-importance\.md\)/i);
  assert.match(limitations, /does not demonstrate external adoption/i);
});

test("the standard check validates the committed ecosystem ledger", () => {
  const scripts = (JSON.parse(read("package.json")) as { scripts: Record<string, string> }).scripts;
  assert.equal(scripts["evidence:check"], "node scripts/validate-ecosystem-evidence.mjs");
  assert.match(scripts.check, /npm run evidence:check/);
});
```

- [ ] **Step 2: Run the focused documentation test and observe failure**

Run the Task 3 documentation test command.

Expected: FAIL because the links and package script are absent.

- [ ] **Step 3: Add restrained public links**

Add one README sentence near the explanation of evidence, not the installation
section:

```markdown
Read the [Ecosystem importance evidence](docs/ecosystem-importance.md) for the
source-linked problem context, current capability mapping, and explicit limits.
```

Add a limitations paragraph:

```markdown
The source-linked [ecosystem importance evidence](ecosystem-importance.md)
explains why auditable maintainer activity can be useful context. It does not
demonstrate external adoption, project impact, endorsement, certification, or
program eligibility.
```

- [ ] **Step 4: Wire offline validation into the standard check**

Add:

```json
"evidence:check": "node scripts/validate-ecosystem-evidence.mjs"
```

Change `check` to:

```json
"check": "biome check . && npm run evidence:check && npm run typecheck && npm test"
```

- [ ] **Step 5: Run focused checks and verify they pass**

Run:

```bash
npm run evidence:check
npm run build
tsc -p tsconfig.test.json
node --test .test-dist/test/docs.test.js .test-dist/test/ecosystem-evidence.test.js
```

Expected: ledger summary is printed and all focused tests pass.

- [ ] **Step 6: Commit the public integration**

```bash
git add README.md docs/limitations.md package.json test/docs.test.ts
git commit -m "docs: link ecosystem evidence"
```

### Task 5: Verify the Complete Change

**Files:**

- Verify only; modify a file only to fix a discovered defect.

- [ ] **Step 1: Check the worktree and diff**

Run:

```bash
git status --short
git diff --check main...HEAD
git diff --stat main...HEAD
```

Expected: only the planned files differ; `git diff --check` prints nothing.

- [ ] **Step 2: Run every local quality gate**

Run each command independently:

```bash
npm run check
npm run schema:check
npm audit --omit=dev
npm run license:check
npm run package:verify
```

Expected: all commands exit 0; tests include the new ledger and documentation
coverage; audit reports zero production vulnerabilities.

- [ ] **Step 3: Verify canonical sources without authentication**

Read the URLs from `docs/ecosystem-importance.sources.json` and request each with
no cookie, authorization header, GitHub token, or browser profile. Follow normal
HTTPS redirects and record final status, final URL, and check date in a private
verification note. Accept only successful public responses. Investigate or
replace a blocked source rather than weakening the check.

Expected: all 13 canonical sources are publicly reachable on 2026-07-20.

- [ ] **Step 4: Run an independent content review**

Review the complete diff against
`docs/superpowers/specs/2026-07-20-ecosystem-importance-evidence-design.md`.
Reject any unsupported claim, source mismatch, implied endorsement, implied
certification, implied adoption, or mismatch with current v0.1.0 behavior.

Expected: no high- or medium-severity findings remain.

- [ ] **Step 5: Commit any verification fixes**

If verification required changes:

```bash
git add <only-the-fixed-files>
git commit -m "fix: tighten ecosystem evidence"
```

If no changes were required, do not create an empty commit.

### Task 6: Publish Through the Protected Repository Workflow

**Files:**

- No additional local files unless review identifies a defect.

- [ ] **Step 1: Reconfirm GitHub identity and exact remote**

Run read-only checks with the ambient invalid token removed:

```bash
env -u GITHUB_TOKEN gh api user --jq .login
git remote get-url origin
```

Expected: login `kilmidas`; remote
`https://github.com/kilmidas/oss-maintainer-evidence.git`.

- [ ] **Step 2: Push the feature branch**

```bash
env -u GITHUB_TOKEN git push --set-upstream origin feature/ecosystem-importance-evidence
```

Expected: the exact feature branch is published to the exact authorized
repository. Do not force-push.

- [ ] **Step 3: Open one focused pull request**

Create a PR whose body states the problem, artifacts, validation, and explicit
non-claims. Do not describe this as adoption evidence or a release.

Expected: one PR targeting `main`, with no issue/comment spam or requested fake
review.

- [ ] **Step 4: Wait for required checks and inspect failures**

Use read-only PR/check commands. If a check fails, inspect the exact log, fix the
root cause locally, rerun the relevant local command, commit, and push normally.

Expected: Node.js 22, Node.js 24, and dependency review requirements pass.

- [ ] **Step 5: Merge through branch protection**

Merge only after the required checks are green and the diff still matches the
reviewed scope. Do not bypass branch protection.

- [ ] **Step 6: Verify the public merged artifacts**

Confirm the merged commit and public signed-out URLs for README,
`docs/ecosystem-importance.md`, and
`docs/ecosystem-importance.sources.json`.

Expected: all three pages are reachable from `main` without authentication.

- [ ] **Step 7: Update the private readiness record**

Update `/Users/user/oss-maintainer-evidence-application-readiness.md` with the
merged commit, PR, public evidence page, public ledger, signed-out verification
date, and an explicit statement that this satisfies ecosystem-importance
documentation but not external adoption.

Do not claim the separate follow-up-release gate is complete as part of this
plan.
