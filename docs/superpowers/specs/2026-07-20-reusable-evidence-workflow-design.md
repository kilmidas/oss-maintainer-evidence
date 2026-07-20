# Reusable evidence workflow design

## Goal

Let an independent maintainer run OSS Maintainer Evidence from their own public GitHub repository without installing the project locally, while producing a verifiable artifact and preserving the project's public-data and read-only boundaries.

## Problem

The released archive is reproducible and independently verifiable, but the current onboarding path still requires a local clone or a multi-step global installation. That friction makes the project harder to evaluate and leaves the release attestation and automated-use story less visible than the implementation warrants.

The project must not turn self-runs into adoption claims. A reusable workflow can demonstrate a real integration surface, but only feedback or runs initiated by independent maintainers are external validation.

## Considered approaches

### 1. Publish to the npm registry

This gives the shortest install command and standard download metrics. It also requires an npm publisher identity and publication authority that are not currently configured. Publishing only to create a metric would be misleading, so this is deferred until publisher identity and demand are established.

### 2. Add a reusable GitHub workflow and release-backed quick start

This lets maintainers call a reusable workflow from their own repository. The recommended caller example pins the reusable workflow itself to the exact 40-character implementation commit SHA. Inside the called job, GitHub's `job.workflow_repository` and `job.workflow_sha` contexts check out the exact repository and commit that define the running workflow into a fixed tool-only directory. The workflow installs the locked dependencies, builds the CLI, collects a JSON report, verifies every evidence link signed out, and uploads the report and verification log as artifacts. It never checks out or executes the caller repository. A separate scheduled smoke workflow exercises the same reusable workflow on this repository without representing the run as external adoption.

The README also documents a tested `npm exec` command against the checksummed GitHub release, giving users a no-global-install path.

This is the chosen approach because it lowers evaluation friction using infrastructure maintainers already use, keeps execution public and reproducible, and does not require a new registry account.

### 3. Add a hosted web service

A hosted form would be easier to discover but would introduce hosting, abuse prevention, data retention, authentication, and operating-cost obligations that are disproportionate to the current project. It would also weaken the local, read-only trust model.

## Workflow contract

The reusable workflow accepts:

- `repository`: one public `owner/repository` target.
- `maintainer`: the GitHub username whose activity is reported.
- `since`: `90d` or an inclusive ISO timestamp, defaulting to `90d`.
- `max_items`: the existing bounded collection limit, defaulting to `200`.

It always emits JSON so the signed-out verifier can validate the complete structured evidence set. It uploads:

- `oss-evidence.json`
- `verification.txt`

The workflow and job both declare only `contents: read`, `issues: read`, and `pull-requests: read`. The latter two scopes are required for authenticated reads of issue details and pull-request reviews; all write access remains disabled. `actions/checkout` uses `repository: ${{ job.workflow_repository }}` and `ref: ${{ job.workflow_sha }}`, sets a fixed `_oss-maintainer-evidence` path, and disables persisted credentials. These job identity values refer to the reusable workflow definition rather than the caller. The caller repository is never checked out.

The workflow declares and references no secret inputs. A caller may syntactically request inherited secrets, but the called workflow has no expression or environment mapping that can expose them. The caller's automatically scoped `${{ github.token }}` is mapped to `GH_TOKEN` only on the collection step; it is never printed. The verification step explicitly clears both `GH_TOKEN` and `GITHUB_TOKEN`, and the existing verifier uses unauthenticated native HTTP. The target remains subject to the CLI's public-repository preflight and fixed `gh api --hostname github.com` endpoint allowlist.

The collection shell disables fail-fast only around the collector, immediately captures the status with `collector || status=$?`, restores fail-fast behavior, and accepts only `0` or `4`. It then requires a nonempty JSON file before verification. Exit `4` is accepted because it means a valid partial report that requires human review. Every other nonzero collection exit fails the workflow.

Verification uses `pipefail` while teeing output to `verification.txt`, so a failed evidence check leaves a diagnostic log and still fails the job. The artifact-upload step uses `if: always()` with a warning for missing files, preserving any prior failure while retaining whatever diagnostics were created.

## Self-smoke workflow

A manual and weekly scheduled workflow calls the reusable workflow for this repository and maintainer. Its purpose is regression detection for the public integration path. Documentation explicitly states that these self-runs are automation checks, not external adoption or independent validation.

## Release and documentation

Version `0.3.0` adds the workflow interface. The README will include:

- a copyable reusable-workflow example pinned to the exact 40-character implementation commit SHA with a `# v0.3.0` comment, caller-side read-only `contents`, `issues`, and `pull-requests` permissions, and no secrets forwarding;
- an optional `@v0.3.0` convenience example labeled as less resistant to a moved tag and not the recommended security path;
- a one-command `npm exec` convenience example pinned to the `v0.3.0` release archive, clearly labeled as not performing checksum or attestation verification automatically;
- a verified installation path that downloads the exact archive and checksum with GitHub CLI, checks SHA-256, validates build provenance with `gh attestation verify`, and executes that local archive;
- an explicit statement that self-smoke runs do not count as adoption.

The changelog and release checklist will describe the integration contract. Registry publication remains disabled with `private: true`.

## Error handling and safety

- All user-controlled values are mapped through step-level `env` entries. No `${{ inputs.* }}` expression appears inside a `run:` body, and the shell passes each value as a quoted `"$VARIABLE"` argument.
- Output paths are fixed under the runner temporary directory.
- The reusable workflow uses only official actions pinned to immutable commit hashes.
- Checkout uses `job.workflow_repository` and `job.workflow_sha` to select the exact repository and commit that define the called workflow, uses a fixed tool directory, and does not persist credentials. Caller code is never checked out or executed.
- `${{ github.token }}` is mapped only to the collection step. The verification step clears `GH_TOKEN` and `GITHUB_TOKEN`, and the workflow never references inherited or named secrets.
- No `pull_request_target`, GitHub mutation command, registry publication, private-repository access, token output, or arbitrary script input is introduced.
- Artifacts use a bounded retention period.

The repository prohibition on new shell subprocess and token-reading behavior continues to apply to product code. This design adds no product subprocess or token access: fixed CI `run` steps invoke the existing CLI, and GitHub Actions injects a step-scoped environment variable that only the already-audited `gh` child process consumes. No code reads a token value or authentication store.

## Testing

Tests will fail before implementation and then enforce:

- the reusable and smoke workflow files exist;
- the reusable inputs, `job.workflow_repository`, `job.workflow_sha`, fixed checkout path, read-only permissions, immutable action pins, non-persisted credentials, collection, signed-out verification, partial-exit handling, and bounded artifact retention are present;
- no unsafe trigger, mutation command, registry publication, token output, or unpinned action appears;
- no caller checkout, workflow secret declaration or reference, run-body input expression, or job-level token mapping appears;
- malicious input samples containing quotes, newlines, spaces, and command-substitution text remain step environment data and cannot become workflow commands; policy tests enforce environment-only input interpolation and quoted shell arguments;
- collection policy tests cover exit `0`, partial exit `4`, all other nonzero exits, missing output, verification failure with a retained log, and always-run artifact upload;
- README and release documentation expose the no-install and reusable-workflow paths without making adoption claims; the recommended caller block uses an exact 40-character SHA, declares only the three required caller-side read permissions, forwards no secrets, and labels the SHA with `# v0.3.0`;
- package metadata remains private;
- `npm run check`, schema validation, dependency audit, license validation, and package verification pass.

Before release approval, completion means the implementation and documentation commits are merged, all local and pull-request checks pass, and no tag has been pushed. The exact workflow implementation commit is created first. A follow-up documentation commit inserts that immutable SHA into the recommended caller example and its policy test. The workflow itself resolves its own source through `job.workflow_repository` and `job.workflow_sha`, so it has no self-referential hard-coded value. The `v0.3.0` tag points to the documentation commit; the recommended reusable-workflow reference remains the immutable implementation SHA.

Creating the tag or release remains a separate external action. Before it happens, the human must receive a summary naming the `v0.3.0` target, archive, checksum, provenance attestation, and reusable-workflow interface and explicitly approve the release. After approval, the tag-triggered release workflow must succeed, its artifacts must be attached to the GitHub release, the checksum and attestation must verify, and the manually triggered smoke workflow must complete successfully before delivery is considered complete.
