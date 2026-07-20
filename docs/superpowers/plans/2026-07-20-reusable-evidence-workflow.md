# Reusable Evidence Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a SHA-pinnable reusable GitHub workflow and release-backed no-install path that let independent maintainers generate and verify a public evidence report without executing caller code or broadening token access.

**Architecture:** A called workflow checks out its own definition repository and commit through `job.workflow_repository` and `job.workflow_sha`, builds in a fixed tool directory, gives the existing collector a read-only token for one step, clears tokens for signed-out verification, and always uploads available diagnostics. A local scheduled caller exercises the same workflow. Documentation is committed after the workflow implementation so its recommended caller example can pin an immutable implementation SHA.

**Tech Stack:** GitHub Actions YAML, Node.js 22, TypeScript policy tests with `node:test`, npm release archives, GitHub artifact attestations.

---

## File map

- `.github/workflows/collect-evidence.yml`: public reusable workflow contract and secure execution boundary.
- `.github/workflows/evidence-smoke.yml`: manual and weekly self-smoke caller; explicitly not adoption evidence.
- `test/workflows.test.ts`: static policy enforcement for triggers, permissions, immutable external actions, the one exact local workflow call, self-checkout, token scope, input handling, exit handling, and diagnostics.
- `test/docs.test.ts`: release quick-start, immutable caller example, and honest interpretation requirements.
- `package.json`, `package-lock.json`: version `0.3.0` source of truth; `src/version.ts` continues reading package metadata without modification.
- `README.md`: reusable workflow, convenience run, verified install, and self-smoke interpretation.
- `docs/independent-validation.md`: versioned workflow validation path and safety checks.
- `docs/release-checklist.md`: reusable-workflow and attestation release checks.
- `CHANGELOG.md`: `0.3.0` public integration summary.

### Task 1: Lock the workflow security contract with failing tests

**Files:**

- Modify: `test/workflows.test.ts`

- [ ] **Step 1: Add the workflow files to the required policy set**

Require `collect-evidence.yml` and `evidence-smoke.yml`. Keep the required workflow-file list separate from the list scanned for external actions. Extend the official action allowlist using the already pinned `checkout`, `setup-node`, and `upload-artifact` SHAs. Exclude only the exact local `uses: ./.github/workflows/collect-evidence.yml` value from the external-action matcher and assert it separately in the smoke test.

- [ ] **Step 2: Add reusable workflow assertions**

Assert all of the following:

```ts
assert.match(workflow, /workflow_call:/);
assert.match(workflow, /repository: \$\{\{ job\.workflow_repository \}\}/);
assert.match(workflow, /ref: \$\{\{ job\.workflow_sha \}\}/);
assert.match(workflow, /path: _oss-maintainer-evidence/);
assert.match(workflow, /persist-credentials: false/);
assert.doesNotMatch(workflow, /secrets:/);
assert.doesNotMatch(workflow, /\$\{\{\s*secrets\./);
assert.doesNotMatch(runBodies, /\$\{\{\s*inputs\./);
```

Also require only `contents: read`, `issues: read`, and `pull-requests: read`, exactly one `GH_TOKEN: ${{ github.token }}` occurrence on the collection step, explicit empty `GH_TOKEN` and `GITHUB_TOKEN` on verification, every input expression only in the collection step's `env`, quoted shell variables, immediate exit capture, acceptance of only `0` and `4`, a nonempty report check, `pipefail`, `if: always()`, bounded retention, and no caller checkout path. Include hostile input samples containing spaces, quotes, a newline, and literal `$(command)` text in the test data; assert the workflow has no run-body input expression and that every shell use is a quoted environment variable. Match the collector block explicitly against this status truth table and exact shell structure:

```yaml
run: |
  status=0
  set +e
  node dist/cli.js collect "$TARGET_REPOSITORY" --maintainer "$TARGET_MAINTAINER" --since "$EVIDENCE_SINCE" --max-items "$MAX_ITEMS" --format json --output "$REPORT_PATH" || status=$?
  set -e
  case "$status" in
    0|4) ;;
    *) exit "$status" ;;
  esac
  test -s "$REPORT_PATH"
```

Match the verifier and upload blocks for a failing verifier with stdout and stderr retained in the log, the pipeline failure preserved, always-run upload, and the exact artifact name `oss-maintainer-evidence`:

```yaml
run: |
  set -o pipefail
  node _oss-maintainer-evidence/dist/cli.js verify "$REPORT_PATH" 2>&1 | tee "$VERIFICATION_PATH"
```

- [ ] **Step 3: Add smoke workflow assertions**

Require only `workflow_dispatch` and weekly `schedule` triggers, a local `uses: ./.github/workflows/collect-evidence.yml` call, the three required read permissions, target `kilmidas/oss-maintainer-evidence`, maintainer `kilmidas`, and no secret forwarding.

- [ ] **Step 4: Run the focused test and observe the intended failure**

Run:

```bash
npm ci
npm run build
npm exec -- tsc -p tsconfig.test.json
node --test .test-dist/test/workflows.test.js
```

Expected: FAIL because both workflow files are absent.

### Task 2: Implement the reusable and smoke workflows

**Files:**

- Create: `.github/workflows/collect-evidence.yml`
- Create: `.github/workflows/evidence-smoke.yml`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `CHANGELOG.md`
- Modify: `test/docs.test.ts`
- Test: `test/workflows.test.ts`

- [ ] **Step 1: Add the reusable workflow interface**

Define required string inputs `repository` and `maintainer`, optional string `since` defaulting to `90d`, and optional number `max_items` defaulting to `200`. Declare only `contents: read`, `issues: read`, and `pull-requests: read` at workflow and job levels.

- [ ] **Step 2: Check out only the called workflow source**

Use the immutable official checkout action with:

```yaml
with:
  repository: ${{ job.workflow_repository }}
  ref: ${{ job.workflow_sha }}
  path: _oss-maintainer-evidence
  persist-credentials: false
```

Set up Node.js 22, run `npm ci`, and build from the fixed tool directory.

- [ ] **Step 3: Collect with bounded inputs and a step-only token**

Map every input through step `env`, map `GH_TOKEN: ${{ github.token }}` only on this step, and use the exact collector shell block from Task 1. Run it from `_oss-maintainer-evidence`, capture the collection status immediately, accept only `0` and `4`, and require a nonempty JSON report in `runner.temp`.

- [ ] **Step 4: Verify signed out and retain diagnostics**

On the verification step set `GH_TOKEN: ""` and `GITHUB_TOKEN: ""`, use the exact verifier block from Task 1 with `2>&1`, and write `verification.txt` in `runner.temp`. Upload both files as `name: oss-maintainer-evidence` with the pinned upload action, `if: always()`, a missing-file warning, and 14-day retention. Test the exact name because the release verification procedure downloads it by name.

- [ ] **Step 5: Add the self-smoke caller**

Call the reusable workflow locally on manual and weekly triggers with read-only permissions. Pass only the public repository, maintainer, reporting window, and bounded item count. Do not pass secrets.

- [ ] **Step 6: Bump the package version to `0.3.0` and keep current docs green**

Update `package.json` and both lockfile root version entries without changing dependencies. Change the existing package-version assertion in `test/docs.test.ts` from `0.2.0` to `0.3.0` without changing the signed-out verifier assertions. Add a minimal `0.3.0` changelog header describing the reusable workflow so the existing changelog-version test remains green. The SHA-dependent documentation comes later.

- [ ] **Step 7: Run the focused workflow policy tests**

Run:

```bash
npm run build
npm exec -- tsc -p tsconfig.test.json
node --test .test-dist/test/workflows.test.js
```

Expected: PASS.

- [ ] **Step 8: Run the full check before the immutable commit**

Run `npm run check`. Expected: PASS with the version and changelog aligned.

- [ ] **Step 9: Commit the immutable workflow implementation**

```bash
git add .github/workflows/collect-evidence.yml .github/workflows/evidence-smoke.yml test/workflows.test.ts test/docs.test.ts package.json package-lock.json CHANGELOG.md
git commit -m "feat: add reusable evidence workflow"
git rev-parse HEAD
```

Record the resulting 40-character SHA as `WORKFLOW_SHA`; do not amend this commit.

### Task 3: Lock documentation and release interpretation with failing tests

**Files:**

- Modify: `test/docs.test.ts`

- [ ] **Step 1: Add documentation policy assertions**

Require the README to contain:

- `uses: kilmidas/oss-maintainer-evidence/.github/workflows/collect-evidence.yml@WORKFLOW_SHA # v0.3.0`;
- caller-side read-only `contents`, `issues`, and `pull-requests` permissions and no `secrets:` in the recommended block;
- the exact `npm exec --yes --package=https://github.com/kilmidas/oss-maintainer-evidence/releases/download/v0.3.0/oss-evidence-0.3.0.tgz -- oss-evidence --version` convenience command;
- `shasum -a 256 -c` and `gh attestation verify` in the verified path;
- `npm exec --yes --package="$PWD/oss-evidence-0.3.0.tgz" -- oss-evidence --version` after checksum and attestation verification, with expected output `0.3.0`;
- language distinguishing self-smoke runs from independent adoption.
- a separate copyable `@v0.3.0` tag example labeled as convenient, movable, and not the recommended security path.

Require the validation guide, checklist, and changelog to describe `0.3.0`, the reusable interface, immutable pinning, and post-release smoke verification.

- [ ] **Step 2: Run the focused documentation test and observe failure**

Run:

```bash
npm run build
npm exec -- tsc -p tsconfig.test.json
node --test .test-dist/test/docs.test.js
```

Expected: FAIL because the new quick starts and release guidance are absent.

### Task 4: Document the immutable caller and verified release paths

**Files:**

- Modify: `README.md`
- Modify: `docs/independent-validation.md`
- Modify: `docs/release-checklist.md`
- Modify: `CHANGELOG.md`
- Test: `test/docs.test.ts`

- [ ] **Step 1: Add the recommended reusable workflow caller**

Insert the exact `WORKFLOW_SHA` from Task 2, read-only caller permissions, required public target inputs, no secret forwarding, and a note that the caller pays runner usage. Explain that a SHA is safer than the optional movable `v0.3.0` tag.

Add a second copyable caller block using `@v0.3.0`. Label it as a convenience form that is not recommended for the strongest supply-chain guarantee because a tag can be moved. Test both blocks and the warning independently.

- [ ] **Step 2: Add convenience and verified release paths**

Label this exact command as convenient but not automatically checksum- or attestation-verified:

```bash
npm exec --yes --package=https://github.com/kilmidas/oss-maintainer-evidence/releases/download/v0.3.0/oss-evidence-0.3.0.tgz -- oss-evidence --version
```

Add a verified path using `gh release download`, SHA-256 verification, `gh attestation verify --repo kilmidas/oss-maintainer-evidence`, and the following exact execution of the downloaded local archive:

```bash
test "$(npm exec --yes --package="$PWD/oss-evidence-0.3.0.tgz" -- oss-evidence --version)" = "0.3.0"
```

- [ ] **Step 3: Document honest interpretation and release checks**

State that the repository's scheduled smoke run proves integration health only. It is not an independent user, adoption, endorsement, or program-eligibility evidence. Add the reusable workflow and smoke validation to the release checklist and describe the change in `CHANGELOG.md`.

- [ ] **Step 4: Run focused documentation tests**

Run:

```bash
npm run build
npm exec -- tsc -p tsconfig.test.json
node --test .test-dist/test/docs.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit documentation without changing the workflow commit**

```bash
git add README.md docs/independent-validation.md docs/release-checklist.md CHANGELOG.md test/docs.test.ts
git commit -m "docs: add reusable workflow quickstart"
git rev-parse HEAD
```

Record the resulting 40-character SHA as `DOC_SHA`.

### Task 5: Verify implementation and review the diff

**Files:**

- Verify all modified files

- [ ] **Step 1: Run the full project gates**

```bash
npm run check
npm run schema:check
npm audit --omit=dev
npm run license:check
npm run package:verify
```

Expected: all commands exit `0`; audit reports zero production vulnerabilities.

- [ ] **Step 2: Inspect packaging and repository state**

```bash
npm pack --dry-run --json
git diff --check origin/main...HEAD
git status --short --branch
```

Expected: version `0.3.0`, intended files only, no build output or credentials, clean worktree after commits.

- [ ] **Step 3: Run an independent code and security review**

Review for caller-code execution, input interpolation in `run`, token leakage, secret forwarding, writable permissions, movable recommended refs, unsafe triggers, registry publication, and unsupported adoption claims. Fix all High and Medium findings and rerun the full gates.

### Task 6: Deliver through pull request and stop at the release gate

**Files:**

- No additional source files unless review fixes are required

- [ ] **Step 1: Push the existing origin branch and open a pull request**

Push `feature/reusable-evidence-workflow`, open a focused pull request, wait for CI and dependency review, and merge with a normal merge commit only when all required checks pass. Do not squash or rebase because both immutable branch commits must remain ancestors of `main`.

- [ ] **Step 2: Verify the merged state**

Confirm the exact merge commit, workflow files on `main`, successful checks, unchanged immutable `WORKFLOW_SHA`, and documentation caller pin. Fetch `origin/main` and require:

```bash
git merge-base --is-ancestor "$WORKFLOW_SHA" origin/main
git merge-base --is-ancestor "$DOC_SHA" origin/main
```

- [ ] **Step 3: Present the required human release summary**

Before any tag or release, report the external target `v0.3.0` and the planned archive `oss-evidence-0.3.0.tgz`, checksum, provenance attestation, reusable workflow, and manual smoke run. Do not create the tag until the human explicitly approves this release.

- [ ] **Step 4: After approval, create and verify the release**

This step remains blocked until explicit approval. After approval, create the tag at the reviewed documentation commit rather than implicit `HEAD`:

```bash
git tag -a v0.3.0 "$DOC_SHA" -m "oss-evidence v0.3.0"
git push origin refs/tags/v0.3.0
```

Create a fresh artifact directory, poll for the `Release Artifacts` run for `DOC_SHA`, require a nonempty identifier, wait with failure propagation, and download only its named artifact:

```bash
RELEASE_ASSET_DIR="$(mktemp -d)"
RELEASE_RUN_ID=""
for attempt in {1..20}; do
  RELEASE_RUN_ID="$(gh run list --repo kilmidas/oss-maintainer-evidence --workflow release-artifacts.yml --event push --commit "$DOC_SHA" --limit 1 --json databaseId --jq '.[0].databaseId // empty')"
  if test -n "$RELEASE_RUN_ID"; then
    break
  fi
  sleep 2
done
test -n "$RELEASE_RUN_ID"
gh run watch "$RELEASE_RUN_ID" --repo kilmidas/oss-maintainer-evidence --exit-status
gh run download "$RELEASE_RUN_ID" --name oss-evidence-v0.3.0 --dir "$RELEASE_ASSET_DIR"
```

Verify the downloaded archive before publication:

```bash
cd "$RELEASE_ASSET_DIR"
shasum -a 256 -c oss-evidence-0.3.0.tgz.sha256
gh attestation verify oss-evidence-0.3.0.tgz --repo kilmidas/oss-maintainer-evidence --signer-workflow kilmidas/oss-maintainer-evidence/.github/workflows/release-artifacts.yml
test "$(npm exec --yes --package="$PWD/oss-evidence-0.3.0.tgz" -- oss-evidence --version)" = "0.3.0"
```

Create the release only after both commands pass, attaching only the verified archive and checksum:

```bash
gh release create v0.3.0 oss-evidence-0.3.0.tgz oss-evidence-0.3.0.tgz.sha256 --repo kilmidas/oss-maintainer-evidence --verify-tag --title "oss-evidence v0.3.0" --generate-notes
```

Verify the documented public no-install URL against the published release and require exact version output:

```bash
test "$(npm exec --yes --package=https://github.com/kilmidas/oss-maintainer-evidence/releases/download/v0.3.0/oss-evidence-0.3.0.tgz -- oss-evidence --version)" = "0.3.0"
```

Finally dispatch `evidence-smoke.yml` on `main`. Record the previous latest run, poll for a different run identifier, require it, wait with failure propagation, and download its evidence artifact into a fresh directory:

```bash
PREVIOUS_SMOKE_RUN_ID="$(gh run list --repo kilmidas/oss-maintainer-evidence --workflow evidence-smoke.yml --event workflow_dispatch --branch main --limit 1 --json databaseId --jq '.[0].databaseId // empty')"
gh workflow run evidence-smoke.yml --repo kilmidas/oss-maintainer-evidence --ref main
SMOKE_RUN_ID=""
for attempt in {1..20}; do
  SMOKE_RUN_ID="$(gh run list --repo kilmidas/oss-maintainer-evidence --workflow evidence-smoke.yml --event workflow_dispatch --branch main --limit 1 --json databaseId --jq '.[0].databaseId // empty')"
  if test -n "$SMOKE_RUN_ID" && test "$SMOKE_RUN_ID" != "$PREVIOUS_SMOKE_RUN_ID"; then
    break
  fi
  sleep 2
done
test -n "$SMOKE_RUN_ID"
test "$SMOKE_RUN_ID" != "$PREVIOUS_SMOKE_RUN_ID"
gh run watch "$SMOKE_RUN_ID" --repo kilmidas/oss-maintainer-evidence --exit-status
SMOKE_ASSET_DIR="$(mktemp -d)"
gh run download "$SMOKE_RUN_ID" --repo kilmidas/oss-maintainer-evidence --name oss-maintainer-evidence --dir "$SMOKE_ASSET_DIR"
test -s "$SMOKE_ASSET_DIR/oss-evidence.json"
test -s "$SMOKE_ASSET_DIR/verification.txt"
```

Do not represent this self-smoke run as external adoption.
