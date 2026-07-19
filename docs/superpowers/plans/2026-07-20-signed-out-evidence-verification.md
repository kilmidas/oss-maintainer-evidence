# Signed-out evidence verification implementation plan

**Goal:** Ship `oss-evidence verify <report.json>` as version 0.2.0, verify the checked-in public example without credentials, publish the protected-branch release, refresh the public evidence report, and use the resulting source links in the application.

**Architecture:** Keep report parsing and URL planning in the domain layer, signed-out HTTP policy in a dedicated transport, bounded concurrency in the application layer, and process behavior in the CLI. All behavior is developed test-first with synthetic reports and a fake fetch preload; the only live network verification is an explicit release-time check.

**Tech stack:** Node.js 22+, TypeScript, Zod, Node test runner, native `fetch`, GitHub Actions, GitHub CLI for explicitly approved repository writes.

---

## Task 1: Parse verification input and build a bounded plan

**Files:**

- Modify: `src/domain/input.ts`
- Modify: `src/domain/report.ts`
- Create: `src/domain/verification.ts`
- Modify: `test/input.test.ts`
- Create: `test/verification.test.ts`

1. Add failing tests for the exact `verify <report.json>` invocation, control-character rejection, strict report-schema validation, deterministic URL ordering, exact de-duplication, fragment-free target grouping, and the 2,000-target cap.
2. Run the focused tests and confirm the intended failures.
3. Export the existing canonical public-GitHub URL schema, implement `parseVerifyInput`, and implement the smallest report-to-plan transformation.
4. Re-run the focused tests and commit.

## Task 2: Read JSON input with a hard byte limit

**Files:**

- Create: `src/io/report-input.ts`
- Create: `test/report-input.test.ts`

1. Add failing tests for a valid file, invalid JSON, directories, missing files, and content larger than 5 MiB.
2. Confirm failures.
3. Implement bounded file-handle reads that never consume more than 5 MiB plus one byte, map failures to concise `InputError` messages, and close handles in all paths.
4. Re-run the tests and commit.

## Task 3: Enforce the signed-out HTTP policy

**Files:**

- Create: `src/http/signed-out-github.ts`
- Create: `test/signed-out-github.test.ts`

1. Add failing tests for 2xx success, explicit non-secret headers, fragment removal, response-body cancellation, same-host redirects, relative redirects, redirect loops, redirect limits, invalid or cross-host locations, non-2xx results, abort timeout, and network failures whose error text contains a synthetic credential.
2. Confirm failures.
3. Implement manual redirects with canonical `https://github.com` validation, a ten-second abort timer, five-redirect cap, safe fixed reason codes, and no response-body or arbitrary-header output.
4. Re-run the tests and commit.

## Task 4: Verify with bounded concurrency and render deterministically

**Files:**

- Create: `src/app/verify.ts`
- Create: `src/render/verification.ts`
- Create: `test/verify-app.test.ts`
- Create: `test/verification-render.test.ts`

1. Add failing tests for at most eight concurrent target requests, one request per grouped target, propagation to distinct fragment evidence links, stable result ordering, all-pass summaries, mixed-failure summaries, and safe text rendering.
2. Confirm failures.
3. Implement the worker pool, typed verification result, and renderer.
4. Re-run the tests and commit.

## Task 5: Wire the CLI and preserve existing behavior

**Files:**

- Modify: `src/cli.ts`
- Modify: `src/errors.ts`
- Modify: `test/cli-help.test.ts`
- Modify: `test/cli-integration.test.ts`
- Create: `test/fixtures/fake-fetch.mjs`

1. Add failing CLI tests for help, invalid verify invocation, pass exit `0`, invalid report exit `2`, one unavailable link exit `6`, synthetic secret non-disclosure, and unchanged collection behavior.
2. Confirm failures.
3. Dynamically load the verification boundary, render complete results before setting exit `6`, and keep startup errors at exit `1`.
4. Re-run the integration tests and commit.

## Task 6: Document and version the feature

**Files:**

- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/limitations.md`
- Modify: `CHANGELOG.md`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `test/cli-help.test.ts`
- Modify: `test/docs.test.ts`

1. Add failing documentation and package assertions for version 0.2.0, both commands, exit `6`, signed-out semantics, and the no-registry-publish boundary.
2. Confirm failures.
3. Update documentation and package metadata without changing schema version 1.0.
4. Re-run focused tests and commit.

## Task 7: Verify, review, and publish through the protected branch

1. Run `npm run check`, `npm run schema:check`, `npm audit --omit=dev`, `npm run license:check`, and `npm run package:verify`.
2. Generate a fresh JSON report for `kilmidas/oss-maintainer-evidence` and run `oss-evidence verify` against it without passing credentials, cookies, GitHub CLI state, or browser state.
3. Run an independent code and security review; fix every high or medium issue and repeat checks.
4. Re-verify the GitHub account is `kilmidas` and the target is exactly `kilmidas/oss-maintainer-evidence` immediately before each write.
5. Push the feature branch, open a pull request linked to the genuine feature issue, wait for all required checks, and merge normally without bypass or force.
6. Create the human-triggered `v0.2.0` release with the package archive and SHA-256 sidecar, then verify the release page and asset checksums signed out.

## Task 8: Refresh evidence and submit the application

1. Collect and verify a post-release public report that includes v0.2.0 and its maintenance trail.
2. Publish the refreshed report through a protected pull request if repository examples need updating.
3. Update the private readiness record with immutable PR, commit, run, release, checksum, ecosystem-source, and verified-report links; preserve zero external-adoption facts.
4. Re-audit every application claim against public sources and the form character limits.
5. Locate the official application form, fill only source-supported facts, submit it using the user's standing approval, capture the confirmation, and report only after receipt is confirmed.
