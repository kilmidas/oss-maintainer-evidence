# OSS Maintainer Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a trustworthy `0.1.0` release of `oss-evidence`, a local, read-only CLI that turns one public GitHub repository's maintainer activity into source-linked Markdown or JSON evidence.

**Architecture:** Keep the command layer thin, put all process execution behind a dependency-injected GitHub CLI adapter, normalize untrusted API responses with Zod, apply explicit attribution rules in pure domain functions, and render one validated report model into deterministic Markdown or JSON. Required collection failures are fatal; optional gaps and capped pagination produce a visible partial report.

**Tech Stack:** Node.js 22+, TypeScript 5.9.3 in ESM/NodeNext mode, Zod 4.4.3, built-in `node:util.parseArgs` and `node:test`, Biome 2.5.4, GitHub CLI, GitHub Actions.

---

## Working Rules

- Follow the approved design in `docs/superpowers/specs/2026-07-19-oss-maintainer-evidence-design.md`.
- Use redacted fixtures only. Never copy private, internal, or corporate repository data into this project.
- Keep every GitHub request made by the `oss-evidence` runtime adapter on `github.com`, use only `GET`, and pass process arguments without a shell. Owner-authorized repository and release administration is outside the runtime adapter and must use only the exact targets named in Tasks 14, 17, and 18.
- Add a failing test before each behavior change, observe the expected failure, implement the smallest passing change, then run the focused test again.
- Run `npm run check` before every task commit once that script exists.
- Commit each completed task separately. Do not squash the public history before `0.1.0`; the history should remain an honest record of development.
- Do not create fabricated issues, reviews, users, stars, downloads, or adoption claims. Any public issue used for release validation must describe a real discovered problem and be closed only by the actual fix.

## Task 1: Establish the Node.js Package and Test Harness

**Files:**

- Create: `package.json`
- Create: `package-lock.json`
- Create: `tsconfig.json`
- Create: `tsconfig.build.json`
- Create: `tsconfig.test.json`
- Create: `biome.json`
- Create: `.gitignore`
- Create: `src/cli.ts`
- Create: `src/version.ts`
- Create: `test/cli-help.test.ts`

- [ ] **Step 1: Add a failing command smoke test**

Write `test/cli-help.test.ts` to spawn the compiled command with `--help` and assert exit `0`, the `oss-evidence collect` usage line, and no standard-error output. At this point there is no build configuration, so record the expected compilation failure.

Run: `npm test`  
Expected: failure because `package.json` or the test/build scripts do not exist.

- [ ] **Step 2: Add exact package metadata and minimal tooling**

Use this dependency policy:

```json
{
  "dependencies": {
    "zod": "4.4.3"
  },
  "devDependencies": {
    "@biomejs/biome": "2.5.4",
    "@types/node": "22.20.1",
    "typescript": "5.9.3"
  }
}
```

Set the exact metadata `name: "oss-evidence"`, `version: "0.1.0"`, `license: "Apache-2.0"`, `type: "module"`, `engines.node: ">=22"`, `bin.oss-evidence: "./dist/cli.js"`, repository and issue URLs under `https://github.com/kilmidas/oss-maintainer-evidence`, and `files` to `dist`, `schema`, `README.md`, `LICENSE`. Add scripts for `build`, `typecheck`, `test`, `format`, `lint`, `check`, and `prepack`. Keep `private: true` throughout `0.1.0`; the first release is the deterministic `oss-evidence-0.1.0.tgz` archive distributed through GitHub Releases and cannot be accidentally published to npm.

Configure TypeScript with `target: "ES2022"`, `module: "NodeNext"`, `moduleResolution: "NodeNext"`, strict checking, Node types, source maps, declarations for the production build, and separate `.test-dist` output for tests. Ignore `node_modules`, `dist`, `.test-dist`, coverage output, generated archives, environment files, and local evidence output.

Run: `npm install`  
Expected: a lockfile with only the declared direct dependencies and platform packages required by Biome.

- [ ] **Step 3: Implement only help and version entry points**

Add the Node shebang to `src/cli.ts`. Use `parseArgs` only to recognize `--help` and `--version`; all unsupported invocations must still fail with exit `2`. Treat root `package.json` as the single version source: `src/version.ts` reads the package file relative to the installed `dist` module with `node:fs`, validates the expected package name and semantic version, and returns that value. Tests must prove `--version`, archive name, changelog heading, and release tag expectations all derive from `0.1.0` rather than duplicate mutable constants.

Run: `npm test`  
Expected: the help test passes.

- [ ] **Step 4: Verify the package skeleton**

Run: `npm run check`  
Expected: format, lint, type checking, tests, and build all pass.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.build.json tsconfig.test.json biome.json .gitignore src/cli.ts src/version.ts test/cli-help.test.ts
git commit -m "build: establish typed CLI package"
```

## Task 2: Define Input, Time-Window, and Error Contracts

**Files:**

- Create: `src/domain/input.ts`
- Create: `src/errors.ts`
- Create: `test/input.test.ts`
- Create: `test/errors.test.ts`
- Modify: `src/cli.ts`

- [ ] **Step 1: Add failing input contract tests**

Cover valid `owner/repository` and maintainer names, case preservation, rejection of URLs, extra path segments, leading dashes, whitespace, control characters, enterprise hosts, `--since 90d`, absolute ISO timestamps, inclusive fixed `until`, default `maxItems: 200`, accepted range `1..1000`, and invalid values. Add a fixed clock to avoid time-sensitive assertions.

Run: `npm test -- --test-name-pattern="input"`  
Expected: failure because the input module does not exist.

- [ ] **Step 2: Implement conservative parsing**

Create `parseCollectInput(argv, now)` that returns a typed command object. Repository and username patterns must allow documented GitHub identifiers while rejecting shell-like or URL input. Convert relative days to a UTC instant and keep the collection start as inclusive `until`.

- [ ] **Step 3: Add typed operational errors**

Define stable error categories for input/scope (`2`), required collection (`3`), partial collection (`4` with report), and output write (`5`). Add safe user messages and a sanitizer that redacts authorization headers and common GitHub/OpenAI token shapes without printing process environments.

Run: `npm test -- --test-name-pattern="input|error|redact"`  
Expected: all focused tests pass.

- [ ] **Step 4: Wire full argument parsing into the command**

Support exactly:

```text
oss-evidence collect owner/repository --maintainer username
  [--since 90d|ISO_TIMESTAMP]
  [--format markdown|json]
  [--output PATH]
  [--max-items 1..1000]
```

Input failures must write one concise safe message to standard error and exit `2`.

Run: `npm run check`  
Expected: all checks pass.

- [ ] **Step 5: Commit**

```bash
git add src/domain/input.ts src/errors.ts src/cli.ts test/input.test.ts test/errors.test.ts
git commit -m "feat: validate bounded collection input"
```

## Task 3: Define the Versioned Report Model

**Files:**

- Create: `src/domain/report.ts`
- Create: `src/domain/aggregate.ts`
- Create: `scripts/generate-schema.mjs`
- Create: `schema/report-v1.json`
- Create: `test/report.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Add failing model and aggregation tests**

Assert all required top-level fields from the design, exact activity types, URL and UTC timestamp validation, nullable unknown adoption values, tri-state community values, structured limitations, pagination metadata, and summary counts derived only from activity arrays. Include a test proving caller-supplied counts cannot override calculated counts.

Run: `npm test -- --test-name-pattern="report|summary"`  
Expected: failure because the schemas and aggregator do not exist.

- [ ] **Step 2: Implement Zod schemas and inferred types**

Use one Zod definition as the source of truth for the report. Keep `schemaVersion` fixed to `1.0`; use discriminated unions for activities and community state. Validate canonical public GitHub URLs with no user information or custom port.

- [ ] **Step 3: Implement deterministic aggregation**

Calculate each summary value from its corresponding normalized activity array. Sort activities by `occurredAt` descending, then stable `type` and `id` tie breakers. Deduplicate only by stable activity identity, never by title.

- [ ] **Step 4: Generate and verify the JSON Schema artifact**

Use Zod's JSON Schema conversion to write `schema/report-v1.json` with a stable title and dialect. Add `schema` and `schema:check` scripts; `schema:check` must fail when regeneration changes the tracked file.

Run: `npm run schema:check && npm run check`  
Expected: all checks pass and the tracked schema is current.

- [ ] **Step 5: Commit**

```bash
git add src/domain/report.ts src/domain/aggregate.ts scripts/generate-schema.mjs schema/report-v1.json test/report.test.ts package.json package-lock.json
git commit -m "feat: define versioned evidence report"
```

## Task 4: Build the Safe GitHub CLI Process Boundary

**Files:**

- Create: `src/process/gh-runner.ts`
- Create: `src/github/endpoints.ts`
- Create: `src/github/contracts.ts`
- Create: `test/gh-runner.test.ts`
- Create: `test/endpoints.test.ts`

- [ ] **Step 1: Add failing process-boundary tests**

Inject a fake spawn function and assert the exact executable and arguments: `gh api --hostname github.com --method GET --include`, official Accept and API-version headers, and one validated endpoint. Assert `shell: false`, bounded timeout, stdout size cap, and no inherited secret values in thrown messages. Simulate missing CLI, timeout, nonzero exit, malformed status/header framing, malformed JSON, rate limit, and authentication failure.

Run: `npm test -- --test-name-pattern="GitHub CLI|endpoint"`  
Expected: failure because the adapter does not exist.

- [ ] **Step 2: Implement a GET-only endpoint builder**

Permit only the documented route families used by this project. Define a typed contract registry that fixes each route's Accept header, API version `2026-03-10`, pagination mode, expected absence status, and classification as required activity or optional metadata. Query values must be encoded by `URLSearchParams`; repository and user values must already pass input validation. Reject absolute URLs, path traversal, mutation methods, GraphQL, and arbitrary endpoint strings at the adapter boundary.

- [ ] **Step 3: Implement bounded process execution**

Use `spawn` with an argument array and `shell: false`. Request `--include`, split the GitHub CLI response into a numeric status, a case-insensitive header map, and a JSON body, then immediately discard every response header except `link`. Capture only bounded stdout/stderr, terminate on timeout, parse JSON after a successful exit, and map safe failure categories without displaying raw headers or environment data. Do not read token environment variables or GitHub authentication files.

Run: `npm test -- --test-name-pattern="GitHub CLI|endpoint"`  
Expected: all focused tests pass.

- [ ] **Step 4: Verify and commit**

Run: `npm run check`  
Expected: all checks pass.

```bash
git add src/process/gh-runner.ts src/github/endpoints.ts src/github/contracts.ts test/gh-runner.test.ts test/endpoints.test.ts
git commit -m "feat: add safe read-only GitHub adapter"
```

## Task 5: Implement Preflight and Bounded Pagination

**Files:**

- Create: `src/github/schemas.ts`
- Create: `src/github/client.ts`
- Create: `test/github-client.test.ts`
- Create: `test/fixtures/repository-public.json`
- Create: `test/fixtures/repository-private.json`

- [ ] **Step 1: Add failing public-scope and pagination tests**

Cover public canonical repository acceptance; private, internal, fork-only community-profile caveat, missing, and non-GitHub URL rejection. Cover `per_page=100`, page progression, Link `rel=next`, exact `maxItems` truncation, no hidden over-count, `204` empty contributors, malformed responses, and search `incomplete_results` or 1,000-result ceiling.

Run: `npm test -- --test-name-pattern="preflight|pagination|search"`  
Expected: failure because the client does not exist.

- [ ] **Step 2: Add minimal response schemas**

Parse only fields the report uses. Unknown response keys remain ignored; missing required keys fail the required operation. Preserve numeric IDs as strings in normalized records where needed to avoid unsafe integer assumptions.

- [ ] **Step 3: Implement repository preflight**

Call `/repos/{owner}/{repo}` before every other endpoint. Require `private: false`, `visibility: "public"`, and a canonical `https://github.com/{owner}/{repo}` URL. Store the API-provided full name and default branch for subsequent calls.

- [ ] **Step 4: Implement manual pagination helpers**

Fetch pages one at a time so `maxItems` is enforceable. Parse only the retained `link` header for `rel="next"`; never log or store raw response headers. Return items, fetched count, and `truncated`. Reaching `maxItems` with a next link means `truncated: true` without fetching beyond the cap. For search, also surface `incomplete_results`, `total_count > maxItems`, and GitHub's 1,000-result limit as partial conditions. Never stop early based only on assumed result ordering; locally enforce the inclusive UTC window.

Run: `npm run check`  
Expected: all checks pass.

- [ ] **Step 5: Commit**

```bash
git add src/github/schemas.ts src/github/client.ts test/github-client.test.ts test/fixtures/repository-public.json test/fixtures/repository-private.json
git commit -m "feat: enforce public scope and bounded pagination"
```

## Task 6: Collect Repository, Release, Community, and Adoption Evidence

**Files:**

- Create: `src/github/collect-repository.ts`
- Create: `test/collect-repository.test.ts`
- Create: `test/fixtures/releases.json`
- Create: `test/fixtures/community-profile.json`
- Create: `test/fixtures/contributors.json`

- [ ] **Step 1: Add failing repository collector tests**

Cover repository facts and observation time, published release attribution, draft and unpublished release exclusion, maintainer case-insensitive comparison, inclusive boundary timestamps, community tri-state values, security policy fallback paths, absent files, unavailable optional endpoints, contributors, and null rather than zero for unknown adoption values.

Run: `npm test -- --test-name-pattern="repository collector|release|community|adoption"`  
Expected: failure because the collector does not exist.

- [ ] **Step 2: Implement required repository and release collection**

Collect repository metadata and all release pages up to the configured cap. A release is attributable only when `author.login` matches, `draft` is false, `published_at` exists, and the publication time is inside the window. Never infer release authorship from tags or commits.

- [ ] **Step 3: Implement optional community and adoption collection**

Use `/community/profile` for standard files. Check `SECURITY.md`, `.github/SECURITY.md`, and `docs/SECURITY.md` on the default branch as read-only fallbacks. Mark endpoint failures `unavailable`, ordinary `404` as absent, and documented inherited-policy uncertainty as a limitation. Collect visible contributors and repository counters with observation times.

Run: `npm run check`  
Expected: all checks pass.

- [ ] **Step 4: Commit**

```bash
git add src/github/collect-repository.ts test/collect-repository.test.ts test/fixtures/releases.json test/fixtures/community-profile.json test/fixtures/contributors.json
git commit -m "feat: collect repository and release evidence"
```

## Task 7: Collect Pull Request and Review Evidence

**Files:**

- Create: `src/github/collect-pulls.ts`
- Create: `test/collect-pulls.test.ts`
- Create: `test/fixtures/search-authored-pulls.json`
- Create: `test/fixtures/search-merged-pulls.json`
- Create: `test/fixtures/search-reviewed-pulls.json`
- Create: `test/fixtures/pull-detail.json`
- Create: `test/fixtures/pull-reviews.json`

- [ ] **Step 1: Add failing attribution tests**

Test authored pull requests by `user/created_at`, merged pull requests only by `merged_by/merged_at`, and submitted reviews only by `review.user/submitted_at`. Cover null actors, dismissed/pending entries without `submitted_at`, case-insensitive user matching, duplicate search candidates, boundary timestamps, PRs merged by another actor, and inaccessible detail endpoints.

Run: `npm test -- --test-name-pattern="pull request|review"`  
Expected: failure because the collector does not exist.

- [ ] **Step 2: Implement authored pull request search**

Use the search query `repo:OWNER/REPO is:public is:pr author:USER created:SINCE..UNTIL`, then locally validate actor, timestamp, repository URL, and item shape. Treat search truncation as partial.

- [ ] **Step 3: Implement merged pull and review detail collection**

Search merged candidates within the window and fetch each pull detail to verify `merged_by`. Search `reviewed-by:USER` candidates, then fetch paginated review records and keep only submitted reviews matching the maintainer and window. Deduplicate reviews by review ID. A failed candidate detail or review-list request is a required activity-endpoint failure: abort with exit `3` and emit no report, because omitting the candidate could understate maintainer work.

Run: `npm run check`  
Expected: all checks pass.

- [ ] **Step 4: Commit**

```bash
git add src/github/collect-pulls.ts test/collect-pulls.test.ts test/fixtures/search-authored-pulls.json test/fixtures/search-merged-pulls.json test/fixtures/search-reviewed-pulls.json test/fixtures/pull-detail.json test/fixtures/pull-reviews.json
git commit -m "feat: collect pull request maintainer evidence"
```

## Task 8: Collect Issue and Comment Evidence

**Files:**

- Create: `src/github/collect-issues.ts`
- Create: `test/collect-issues.test.ts`
- Create: `test/fixtures/search-opened-issues.json`
- Create: `test/fixtures/search-closed-issues.json`
- Create: `test/fixtures/issue-detail.json`
- Create: `test/fixtures/issue-comments.json`

- [ ] **Step 1: Add failing issue attribution tests**

Test opened issues by `user/created_at`, closed issues only by `closed_by/closed_at`, and issue comments by `user/created_at`. Exclude every object containing `pull_request`, including comments whose parent issue is a pull request. Cover the one-second `since` overlap used for comment API semantics and prove that local filtering restores the inclusive exact window without duplicates.

Run: `npm test -- --test-name-pattern="issue|comment"`  
Expected: failure because the collector does not exist.

- [ ] **Step 2: Implement opened and closed issue search**

Use `is:issue`, validate results locally, and fetch details for closed candidates so attribution uses `closed_by`. Do not infer triage from labels, assignees, or timeline ordering.

- [ ] **Step 3: Implement repository issue comment collection**

Request comments sorted ascending with `since` set one second before the desired boundary, then filter exactly by actor and `created_at`. Fetch and cache parent issue records to exclude pull request discussion comments. A failed closed-issue detail or parent-issue request is a required activity-endpoint failure: abort with exit `3` and emit no report. Capped pages remain partial with exit `4` because the report can identify the exact truncation.

Run: `npm run check`  
Expected: all checks pass.

- [ ] **Step 4: Commit**

```bash
git add src/github/collect-issues.ts test/collect-issues.test.ts test/fixtures/search-opened-issues.json test/fixtures/search-closed-issues.json test/fixtures/issue-detail.json test/fixtures/issue-comments.json
git commit -m "feat: collect issue maintainer evidence"
```

## Task 9: Orchestrate Complete and Partial Collection

**Files:**

- Create: `src/app/collect.ts`
- Create: `test/collect-app.test.ts`
- Modify: `src/domain/aggregate.ts`

- [ ] **Step 1: Add failing orchestration tests**

With injected collectors and a fixed clock, prove preflight runs first, required list/search calls and every attribution-required detail call fail closed with exit category `3` and no report, optional community/security-policy/contributor endpoint failures generate structured limitations and `status: partial`, pagination caps set `truncated`, deterministic ordering holds regardless of completion order, and all summary counts match final arrays.

Run: `npm test -- --test-name-pattern="collection orchestration"`  
Expected: failure because the application service does not exist.

- [ ] **Step 2: Implement the collection service**

After successful preflight, run independent collectors with bounded concurrency. Merge evidence only after validation. Record pagination metadata for every paginated resource. Convert optional gaps and truncation to stable limitation codes; never silently turn missing data into empty arrays or zero.

- [ ] **Step 3: Validate the final report at the boundary**

Before rendering, parse the assembled object with the report schema. Treat a validation bug as a required collection failure with a safe message and no misleading report.

Run: `npm run check`  
Expected: all checks pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/collect.ts src/domain/aggregate.ts test/collect-app.test.ts
git commit -m "feat: assemble trustworthy evidence reports"
```

## Task 10: Render Deterministic Markdown and JSON

**Files:**

- Create: `src/render/markdown.ts`
- Create: `src/render/json.ts`
- Create: `test/render.test.ts`
- Create: `test/golden/report-complete.md`
- Create: `test/golden/report-complete.json`
- Create: `test/golden/report-partial.md`

- [ ] **Step 1: Add failing golden and safety tests**

Assert all eight Markdown sections from the design, a prominent partial warning, stable source links, UTC dates, human-readable zero-event sections, and an evidence appendix. Include hostile repository titles containing Markdown links, HTML, pipes, newlines, and control characters; assert they cannot inject headings or executable HTML. Assert JSON has stable two-space formatting and a final newline.

Run: `npm test -- --test-name-pattern="render"`  
Expected: failure because renderers do not exist.

- [ ] **Step 2: Implement Markdown rendering**

Escape untrusted text, allow only validated canonical source URLs, label calculated summaries, distinguish absent from unavailable, and list every limitation. Keep headings stable for later automated comparison.

- [ ] **Step 3: Implement deterministic JSON rendering**

Render only the already-validated report. Do not add dynamic fields outside the schema. Keep ordering controlled by the model assembly and serializer.

Run: `npm test -- --test-name-pattern="render"`  
Expected: golden tests pass after reviewed fixtures are accepted.

- [ ] **Step 4: Verify and commit**

Run: `npm run check`  
Expected: all checks pass.

```bash
git add src/render/markdown.ts src/render/json.ts test/render.test.ts test/golden/report-complete.md test/golden/report-complete.json test/golden/report-partial.md
git commit -m "feat: render source-linked evidence packs"
```

## Task 11: Complete CLI Output and Exit-Code Integration

**Files:**

- Create: `src/io/output.ts`
- Create: `test/cli-integration.test.ts`
- Create: `test/fixtures/fake-gh.mjs`
- Modify: `src/cli.ts`

- [ ] **Step 1: Add failing end-to-end CLI tests**

Run the compiled command against a fake `gh` executable backed by public synthetic fixtures. Cover Markdown to stdout, JSON to stdout, explicit output file, no report on required failure, partial report with exit `4`, input exit `2`, required adapter exit `3`, unwritable path exit `5`, help, and version. Confirm stderr contains no synthetic token placed in the fake process environment.

Run: `npm test -- --test-name-pattern="CLI integration"`  
Expected: failure because full command wiring and output handling do not exist.

- [ ] **Step 2: Implement safe output writing**

Write stdout only after full render succeeds. For files, create the target with an atomic temporary sibling and rename; reject directories and surface a concise exit `5` error. Never overwrite an existing file unless an explicit future option authorizes it; first release should fail safely.

- [ ] **Step 3: Wire command dependencies and exit codes**

Build the real client, collectors, application service, renderer, and output adapter in `src/cli.ts`. Keep dependency construction separate from argument parsing so tests can inject fakes. Partial reports must be emitted even though the process exits `4`.

Run: `npm run check`  
Expected: all checks pass, including the compiled fake-CLI scenarios.

- [ ] **Step 4: Commit**

```bash
git add src/io/output.ts src/cli.ts test/cli-integration.test.ts test/fixtures/fake-gh.mjs
git commit -m "feat: complete CLI collection workflow"
```

## Task 12: Add Public Documentation and Community Standards

**Files:**

- Create: `README.md`
- Create: `LICENSE`
- Create: `CONTRIBUTING.md`
- Create: `CODE_OF_CONDUCT.md`
- Create: `SECURITY.md`
- Create: `SUPPORT.md`
- Create: `CHANGELOG.md`
- Create: `AGENTS.md`
- Create: `docs/architecture.md`
- Create: `docs/attribution.md`
- Create: `docs/limitations.md`
- Create: `.github/ISSUE_TEMPLATE/bug.yml`
- Create: `.github/ISSUE_TEMPLATE/feature.yml`
- Create: `.github/ISSUE_TEMPLATE/config.yml`
- Create: `.github/PULL_REQUEST_TEMPLATE.md`
- Create: `test/docs.test.ts`

- [ ] **Step 1: Add failing documentation contract tests**

Check that every required community file exists, README code samples match current help output, all local Markdown links resolve, security contact is a safe public GitHub reporting path, and forbidden claims such as guaranteed program acceptance or private-repository support are absent.

Run: `npm test -- --test-name-pattern="documentation"`  
Expected: failure because public documentation does not exist.

- [ ] **Step 2: Write an English README for independent users**

Document the problem, installation from the GitHub release or source, prerequisites, exact command examples, sample sections, read-only architecture, public-data scope, privacy review, exit codes, limitations, and roadmap. State that the tool reports evidence and never decides grant or program eligibility.

- [ ] **Step 3: Add governance and contributor files**

Use Apache-2.0. Add a contributor workflow with tests and small pull requests, Contributor Covenant text with a public enforcement route, a coordinated vulnerability process using GitHub private vulnerability reporting when enabled, support boundaries, a keep-a-changelog `0.1.0` entry, and issue/PR templates that request reproducible public data only.

- [ ] **Step 4: Document internals and Codex workflow**

Explain architecture, exact attribution rules, known API gaps, and local Codex commands. `AGENTS.md` must require tests, public fixtures, GET-only GitHub access, no secrets, and human approval for releases or external comments.

Run: `npm run check`  
Expected: all checks and documentation link tests pass.

- [ ] **Step 5: Commit**

```bash
git add README.md LICENSE CONTRIBUTING.md CODE_OF_CONDUCT.md SECURITY.md SUPPORT.md CHANGELOG.md AGENTS.md docs/architecture.md docs/attribution.md docs/limitations.md .github/ISSUE_TEMPLATE .github/PULL_REQUEST_TEMPLATE.md test/docs.test.ts
git commit -m "docs: establish public contributor standards"
```

## Task 13: Add Continuous Integration, Dependency Review, and Release Checks

**Files:**

- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/dependency-review.yml`
- Create: `.github/workflows/release-artifacts.yml`
- Create: `.github/dependabot.yml`
- Create: `.github/release.yml`
- Create: `scripts/check-licenses.mjs`
- Create: `scripts/verify-package.mjs`
- Create: `test/workflows.test.ts`
- Create: `test/licenses.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Add failing workflow policy tests**

Parse workflow text and assert least-privilege default permissions, pinned major official actions, no `pull_request_target`, no untrusted script downloads, Node 22 and 24 test matrix, dependency review on pull requests, and no automatic registry publication. Add license-policy tests that reject missing, unknown, copyleft-incompatible, or unapproved dependency license expressions and accept the reviewed SPDX allowlist.

Run: `npm test -- --test-name-pattern="workflow"`  
Expected: failure because workflows do not exist.

- [ ] **Step 2: Add the CI workflow**

Run install with `npm ci`, schema freshness, format/lint, type check, tests, build, `npm audit --omit=dev`, dependency license checking, and a real pack/install/help/version smoke test on both Node 22 and 24. `scripts/check-licenses.mjs` must inspect the installed direct and transitive packages against a reviewed SPDX allowlist and print package names plus license identifiers, never file contents. `scripts/verify-package.mjs` must create a bounded temporary directory, pack the current checkout, install that archive, invoke the installed binary, and clean only its own temporary paths. Use read-only contents permission and official checkout/setup-node actions. Upload no fixture or report data.

- [ ] **Step 3: Add dependency and release metadata**

Configure weekly npm updates with a small open-request cap. Add dependency review with read permissions. Configure generated release-note categories, but keep tagging and publishing human-triggered. Add a tag-triggered `release-artifacts.yml` that rebuilds the archive from the tag, generates a SHA-256 checksum, creates GitHub build provenance with `actions/attest-build-provenance`, and uploads the archive plus checksum as workflow artifacts. Give only that job `id-token: write`, `attestations: write`, and `contents: read`; it must not create a release or publish to a registry.

Run: `npm run check && npm run license:check && npm run package:verify`
Expected: local checks pass, every dependency license is approved, and a clean archive install exposes the expected help and version.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/dependency-review.yml .github/workflows/release-artifacts.yml .github/dependabot.yml .github/release.yml scripts/check-licenses.mjs scripts/verify-package.mjs test/workflows.test.ts test/licenses.test.ts package.json package-lock.json
git commit -m "ci: verify builds and dependencies"
```

## Task 14: Create the Public Repository and Verify Pre-Release CI

**Remote actions:**

- Create: `https://github.com/kilmidas/oss-maintainer-evidence`
- Push: reviewed local `main` history
- Configure: description, topics, issue tracker, private vulnerability reporting, and available branch protection or rulesets

The repository owner explicitly authorized creation, push, profile setup, and application completion in the current conversation on 2026-07-19. That authorization covers repository creation plus branch, pull request, merge, tag, release, setting, and profile writes named in Tasks 14–18, only for `kilmidas/oss-maintainer-evidence` and `kilmidas/kilmidas`. Before each write, verify the authenticated account and exact target. Stop only if the account, repository, visibility, or action differs from this recorded scope. npm publication is not part of `0.1.0` and remains blocked by `private: true`.

- [ ] **Step 1: Finish and integrate the reviewed implementation branch**

After Tasks 1–13 pass both compliance and code-quality review, use the documented branch-finishing procedure to integrate the exact reviewed commits into local `main`. Run `npm run check` on `main` and verify a clean worktree before any remote creation.

- [ ] **Step 2: Recheck namespace and authenticated identity**

Use the public GitHub API to confirm the exact repository path is still available. Use `gh auth status --hostname github.com` without printing credential material, and verify the authenticated account is exactly `kilmidas`. If authentication is missing, use GitHub's official web login flow; never inspect token files, cookies, or browser storage.

- [ ] **Step 3: Create the public repository and push the reviewed history**

Create a public repository without auto-generated files, add `origin`, push `main`, and set the repository description and factual topics. The tracked Apache-2.0 file is the only license source. Verify the signed-out public URL and compare the remote head with the local head.

- [ ] **Step 4: Verify public automation and repository health**

Wait for CI on the initial `main` push. The dependency-review workflow runs only on pull requests, so at this step inspect its trigger and permissions but do not claim it has executed. Enable private vulnerability reporting and protections available to the account without weakening contributor access. Confirm license detection, community files, issue templates, security policy, and exact workflow permissions through public pages or API responses. Fix real failures on a focused branch and let CI rerun.

## Task 15: Produce and Verify the `0.1.0` Release Candidate

**Files:**

- Create: `examples/oss-maintainer-evidence.md`
- Create: `examples/oss-maintainer-evidence.json`
- Create: `docs/release-checklist.md`
- Modify: `README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Build and run the real command on its public repository**

Run collection for `kilmidas/oss-maintainer-evidence` only after Task 14 makes the repository public. Inspect every link in the report. Early activity may legitimately be sparse; preserve truthful zero values and limitations.

Run:

```bash
npm run build
node dist/cli.js collect kilmidas/oss-maintainer-evidence --maintainer kilmidas --since 90d --format markdown --output examples/oss-maintainer-evidence.md
node dist/cli.js collect kilmidas/oss-maintainer-evidence --maintainer kilmidas --since 90d --format json --output examples/oss-maintainer-evidence.json
```

Expected: both outputs validate, use only public GitHub links, and contain no secrets.

- [ ] **Step 2: Finalize release-facing content before packaging**

Run:

```bash
npm run check
npm audit --omit=dev
npm run license:check
npm pack --dry-run
```

Add the verified example links to README, finalize `CHANGELOG.md`, and write a release checklist covering CI, dependency licenses, archive contents, public link inspection, secret scan, tag/version match, attestation verification, checksum generation, and recovery guidance. Review all of these tracked changes before creating the final archive.

- [ ] **Step 3: Submit the release candidate through a real pull request**

Create `release/0.1.0` from the current remote `main`, then commit only the reviewed release-candidate files:

```bash
git switch -c release/0.1.0
git add examples docs/release-checklist.md README.md CHANGELOG.md
git commit -m "docs: prepare 0.1.0 release candidate"
git push -u origin release/0.1.0
```

Create a pull request from `release/0.1.0` to `main` describing the real generated examples and release checks. Wait for Node 22 and 24 CI, dependency review, and archive-install checks. Merge only after every required check passes, then update local `main` by fast-forward. Do not tag or retain any pre-merge archive as a release candidate.

## Task 16: Run an Independent Pre-Release Audit

**Review scope:** all tracked project files, public repository settings, generated examples, and the exact commit proposed for release

- [ ] **Step 1: Run an independent code and trust-boundary review**

Have a reviewer inspect input handling, subprocess execution, `--include` framing, endpoint allowlist, response validation, attribution rules, required versus optional endpoint failures, partial semantics, Markdown escaping, output safety, tests, workflows, and documentation claims. Fix every confirmed high or medium severity issue with a failing regression test and a separate commit.

- [ ] **Step 2: Fix findings and freeze the reviewed commit**

Fix confirmed findings with regression tests on a focused branch, open a pull request, and wait for the complete Node 22 and 24 plus dependency-review matrix before merging. Then verify a clean worktree and matching local and remote `main` commits. Record that exact commit identifier as the proposed release commit; any subsequent tracked change invalidates the freeze.

- [ ] **Step 3: Build the local candidate from a clean checkout**

Create a detached temporary worktree at the frozen commit. Inside it run `npm ci`, `npm run check`, `npm audit --omit=dev`, `npm run license:check`, and `npm run package:verify`, then create the archive with `npm pack`. Inspect the file list, install it in another fresh temporary directory, run help/version, and calculate SHA-256. Store the archive, checksum, commit identifier, and CI URL only in a dedicated temporary release-staging directory outside the tracked tree. Remove the detached worktree after verification. This local artifact proves reproducibility but is not yet the attested release asset.

## Task 17: Publish and Reproduce the GitHub `0.1.0` Release

- [ ] **Step 1: Verify recorded owner authorization and release target**

Confirm the current authenticated account is `kilmidas`, the target is `kilmidas/oss-maintainer-evidence`, the release is public `v0.1.0`, and the frozen commit is still remote `main`. The current owner directive authorizes this GitHub release. Do not publish to npm or any unrelated registry.

- [ ] **Step 2: Tag the frozen commit and obtain the attested artifact**

Create annotated tag `v0.1.0` on the frozen commit and push only that tag. Wait for `release-artifacts.yml`, then download its archive and checksum. Verify the GitHub build provenance with `gh attestation verify --repo kilmidas/oss-maintainer-evidence`, verify the checksum, compare package file lists with the local candidate, and repeat the clean install help/version smoke test. A failed attestation or package-content mismatch blocks release publication.

- [ ] **Step 3: Publish and verify the GitHub release**

Create the GitHub release for `v0.1.0`, attach only the attested workflow archive and checksum, and publish reviewed release notes. Download those public assets into a fresh temporary directory, verify provenance and checksum again, install the archive, run help/version, and collect a JSON report from the public repository. Validate the report against `schema/report-v1.json` and verify every evidence URL opens publicly.

- [ ] **Step 4: Record any post-release metadata update**

If the final release URL requires a README or changelog link update, make one focused commit on `main`, push it, and wait for CI. The `v0.1.0` tag remains on the frozen release commit.

## Task 18: Improve the Public Profile and Capture Application Evidence

**Remote and local files:**

- Create or modify in a separate profile repository: `kilmidas/kilmidas/README.md`
- Pin: `kilmidas/oss-maintainer-evidence`

- [ ] **Step 1: Create a minimal factual profile README**

State the owner's public role as the maintainer of OSS Maintainer Evidence, link the repository and latest release, and explain the local Codex maintenance workflow. Use repository issues and the documented security channel for contact. Do not publish the application email, mention internal repositories, or make unverifiable employer or adoption claims.

- [ ] **Step 2: Pin and verify the project**

Pin the repository using supported GitHub controls. Open the signed-out public profile and confirm the README, pin, repository description, release, and activity links are visible.

- [ ] **Step 3: Commit and push profile changes**

Keep the profile repository history factual and separate from product history. Do not manufacture contribution activity.

- [ ] **Step 4: Record public application evidence**

Capture only public URLs and current observed facts: repository, release, passing CI run, security policy, example report, profile, license, current stars/forks/contributors, and the owner's visible maintainer permissions. Label small or zero metrics honestly. Do not turn initialization commits into claims of long-term maintenance.

## Completion Gate

The implementation and first-release plan is complete only when all of the following are true:

- `oss-evidence` works from a clean public release install on a supported Node version.
- Local checks and public CI pass on the release commit.
- The report contract, attribution rules, partial semantics, and limitations are documented and tested.
- The repository, release archive, example reports, security policy, and profile are publicly accessible.
- The public history contains the real design, implementation, review fixes, and release work without fabricated activity.
- An independent pre-release audit reports no unresolved high or medium severity issue.

After this gate, begin the separate real-maintenance phase: use the release, record genuine defects or documentation gaps as public issues, fix them through reviewed branches, and publish a follow-up release when justified. Application drafting and submission remain blocked until a fresh readiness audit confirms every condition in the approved design, including real issue, fix, review, follow-up release, and current ecosystem or adoption evidence. The application must describe the project as it exists at submission time and must not claim guaranteed eligibility, established adoption, or long-term maintenance unless public evidence then supports those claims. Obtain or reconfirm explicit owner approval for the final populated form immediately before submission.
