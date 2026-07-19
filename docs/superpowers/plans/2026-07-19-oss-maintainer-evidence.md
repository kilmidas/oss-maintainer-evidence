# OSS Maintainer Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a trustworthy `0.1.0` release of `oss-evidence`, a local, read-only CLI that turns one public GitHub repository's maintainer activity into source-linked Markdown or JSON evidence.

**Architecture:** Keep the command layer thin, put all process execution behind a dependency-injected GitHub CLI adapter, normalize untrusted API responses with Zod, apply explicit attribution rules in pure domain functions, and render one validated report model into deterministic Markdown or JSON. Required collection failures are fatal; optional gaps and capped pagination produce a visible partial report.

**Tech Stack:** Node.js 22+, TypeScript 5.9.3 in ESM/NodeNext mode, Zod 4.4.3, built-in `node:util.parseArgs` and `node:test`, Biome 2.5.4, GitHub CLI, GitHub Actions.

---

## Working Rules

- Follow the approved design in `docs/superpowers/specs/2026-07-19-oss-maintainer-evidence-design.md`.
- Use redacted fixtures only. Never copy private, internal, or corporate repository data into this project.
- Keep all GitHub requests on `github.com`, use only `GET`, and pass process arguments without a shell.
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

Set `type: "module"`, `engines.node: ">=22"`, `bin.oss-evidence: "./dist/cli.js"`, `files` to `dist`, `schema`, `README.md`, `LICENSE`, and package scripts for `build`, `typecheck`, `test`, `format`, `lint`, `check`, and `prepack`. Keep the package private until release preparation; do not publish from this task.

Configure TypeScript with `target: "ES2022"`, `module: "NodeNext"`, `moduleResolution: "NodeNext"`, strict checking, Node types, source maps, declarations for the production build, and separate `.test-dist` output for tests. Ignore `node_modules`, `dist`, `.test-dist`, coverage output, generated archives, environment files, and local evidence output.

Run: `npm install`  
Expected: a lockfile with only the declared direct dependencies and platform packages required by Biome.

- [ ] **Step 3: Implement only help and version entry points**

Add the Node shebang to `src/cli.ts`. Use `parseArgs` only to recognize `--help` and `--version`; all unsupported invocations must still fail with exit `2`. Read the version from a generated constant or package metadata without importing JSON through an unstable path.

Run: `npm test`  
Expected: the help test passes.

- [ ] **Step 4: Verify the package skeleton**

Run: `npm run check`  
Expected: format, lint, type checking, tests, and build all pass.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.build.json tsconfig.test.json biome.json .gitignore src/cli.ts test/cli-help.test.ts
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
- Create: `test/gh-runner.test.ts`
- Create: `test/endpoints.test.ts`

- [ ] **Step 1: Add failing process-boundary tests**

Inject a fake spawn function and assert the exact executable and arguments: `gh api --hostname github.com --method GET`, official Accept and API-version headers, and one validated endpoint. Assert `shell: false`, bounded timeout, stdout size cap, and no inherited secret values in thrown messages. Simulate missing CLI, timeout, nonzero exit, malformed JSON, rate limit, and authentication failure.

Run: `npm test -- --test-name-pattern="GitHub CLI|endpoint"`  
Expected: failure because the adapter does not exist.

- [ ] **Step 2: Implement a GET-only endpoint builder**

Permit only the documented route families used by this project. Query values must be encoded by `URLSearchParams`; repository and user values must already pass input validation. Reject absolute URLs, path traversal, mutation methods, GraphQL, and arbitrary endpoint strings at the adapter boundary.

- [ ] **Step 3: Implement bounded process execution**

Use `spawn` with an argument array and `shell: false`. Capture only bounded stdout/stderr, terminate on timeout, parse JSON after a successful exit, and map safe failure categories without displaying raw headers or environment data. Do not read token environment variables or GitHub authentication files.

Run: `npm test -- --test-name-pattern="GitHub CLI|endpoint"`  
Expected: all focused tests pass.

- [ ] **Step 4: Verify and commit**

Run: `npm run check`  
Expected: all checks pass.

```bash
git add src/process/gh-runner.ts src/github/endpoints.ts test/gh-runner.test.ts test/endpoints.test.ts
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

Fetch pages one at a time so `maxItems` is enforceable. Return items, fetched count, and `truncated`. For search, also surface `incomplete_results`, `total_count > maxItems`, and GitHub's 1,000-result limit as partial conditions. Never stop early based only on assumed result ordering; locally enforce the inclusive UTC window.

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

Search merged candidates within the window and fetch each pull detail to verify `merged_by`. Search `reviewed-by:USER` candidates, then fetch paginated review records and keep only submitted reviews matching the maintainer and window. Deduplicate reviews by review ID.

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

Request comments sorted ascending with `since` set one second before the desired boundary, then filter exactly by actor and `created_at`. Fetch and cache parent issue records to exclude pull request discussion comments. Surface capped pages or unavailable required parents as required/partial failures according to whether attribution can remain complete.

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

With injected collectors and a fixed clock, prove preflight runs first, required collectors fail closed with exit category `3` and no report, optional endpoint failures generate structured limitations and `status: partial`, pagination caps set `truncated`, deterministic ordering holds regardless of completion order, and all summary counts match final arrays.

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
- Create: `.github/dependabot.yml`
- Create: `.github/release.yml`
- Create: `test/workflows.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Add failing workflow policy tests**

Parse workflow text and assert least-privilege default permissions, pinned major official actions, no `pull_request_target`, no untrusted script downloads, Node 22 and 24 test matrix, dependency review on pull requests, and no automatic package publication.

Run: `npm test -- --test-name-pattern="workflow"`  
Expected: failure because workflows do not exist.

- [ ] **Step 2: Add the CI workflow**

Run install with `npm ci`, schema freshness, format/lint, type check, tests, build, `npm audit --omit=dev`, and `npm pack --dry-run`. Use read-only contents permission and official checkout/setup-node actions. Upload no fixture or report data.

- [ ] **Step 3: Add dependency and release metadata**

Configure weekly npm updates with a small open-request cap. Add dependency review with read permissions. Configure generated release-note categories, but keep tagging and publishing human-triggered.

Run: `npm run check && npm pack --dry-run`  
Expected: local checks pass and the archive contains only intended distributable files.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/dependency-review.yml .github/dependabot.yml .github/release.yml test/workflows.test.ts package.json package-lock.json
git commit -m "ci: verify builds and dependencies"
```

## Task 14: Produce and Verify the `0.1.0` Release Candidate

**Files:**

- Create: `examples/oss-maintainer-evidence.md`
- Create: `examples/oss-maintainer-evidence.json`
- Create: `docs/release-checklist.md`
- Modify: `README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Build and run the real command on its public repository**

This step occurs only after the GitHub repository is public and GitHub CLI login works. Run collection for `kilmidas/oss-maintainer-evidence` and inspect every link in the report. Early repository activity may legitimately be sparse; preserve truthful zeros and limitations.

Run:

```bash
npm run build
node dist/cli.js collect kilmidas/oss-maintainer-evidence --maintainer kilmidas --since 90d --format markdown --output examples/oss-maintainer-evidence.md
node dist/cli.js collect kilmidas/oss-maintainer-evidence --maintainer kilmidas --since 90d --format json --output examples/oss-maintainer-evidence.json
```

Expected: both outputs validate, use only public GitHub links, and contain no secrets.

- [ ] **Step 2: Run clean package verification**

Run:

```bash
npm run check
npm audit --omit=dev
npm pack --dry-run
```

Install the generated archive in a new temporary directory, then run `oss-evidence --help` and `oss-evidence --version`. Confirm Node 22 and 24 in CI before tagging.

- [ ] **Step 3: Review release-facing content**

Add the verified example links to README, finalize `CHANGELOG.md`, and write a release checklist covering CI, package contents, public link inspection, secret scan, tag/version match, and rollback guidance.

- [ ] **Step 4: Commit the release candidate**

```bash
git add examples docs/release-checklist.md README.md CHANGELOG.md
git commit -m "docs: prepare 0.1.0 release candidate"
```

## Task 15: Publish the Public Repository and GitHub Release

**Remote actions:**

- Create: `https://github.com/kilmidas/oss-maintainer-evidence`
- Push: local `main` history
- Configure: description, topics, homepage if applicable, issue tracker, vulnerability reporting, branch protection/ruleset when account capabilities allow it
- Release: tag `v0.1.0` with generated notes and verified package archive

- [ ] **Step 1: Recheck namespace and authenticated identity**

Use public GitHub API to confirm the exact repository path is still available. Use `gh auth status --hostname github.com` without printing credential material, and verify the authenticated account is `kilmidas`. If authentication is missing, use GitHub's official web login flow; never inspect token files, cookies, or browser storage.

- [ ] **Step 2: Create the public repository and push the reviewed history**

Create an Apache-2.0 public repository without auto-generated files, add `origin`, push `main`, and set the repository description and topics. Verify the public signed-out URL and compare the remote head with the local head.

- [ ] **Step 3: Verify public automation and repository health**

Wait for CI and dependency checks. Enable private vulnerability reporting and available branch/ruleset protections without weakening contributor access. Confirm community-profile detection, license detection, issue templates, security policy, and release readiness through public API responses.

- [ ] **Step 4: Create the real `0.1.0` release**

Create annotated tag `v0.1.0` only after CI passes. Build the archive from the exact tag, verify its checksums and contents, attach it to the GitHub release, and publish reviewed release notes. Publish to npm only if official npm authentication is already available, the name remains unclaimed, and the package archive matches the tag; otherwise document GitHub installation and leave npm publication for a later release.

- [ ] **Step 5: Verify release reproducibility**

Download the public release archive into a fresh temporary directory, install it, run help/version, and collect a JSON report from the public repository. Confirm the report validates against `schema/report-v1.json` and every evidence URL opens publicly.

- [ ] **Step 6: Record the publication commit or metadata update**

If release URLs or npm status require documentation changes, add one focused commit and wait for CI again. Do not rewrite or force-push history.

## Task 16: Improve the Public GitHub Profile Truthfully

**Remote and local files:**

- Create or modify in a separate profile repository: `kilmidas/kilmidas/README.md`
- Pin: `kilmidas/oss-maintainer-evidence`

- [ ] **Step 1: Create a minimal factual profile README**

State 김성훈's public role as the maintainer of OSS Maintainer Evidence, link the repository and latest release, explain the local Codex maintenance workflow, and provide the public contact already supplied by the owner. Do not mention internal repositories or unverifiable employer work.

- [ ] **Step 2: Pin and verify the project**

Pin the repository using supported GitHub controls. Open the signed-out public profile and confirm the README, pin, repository description, release, and activity links are visible.

- [ ] **Step 3: Commit and push profile changes**

Keep the profile repository history factual and separate from product history. Do not manufacture contribution activity.

## Task 17: Independent Release Audit

**Review scope:** all tracked project files, public repository settings, release artifact, and public profile

- [ ] **Step 1: Run an independent code and trust-boundary review**

Have a reviewer inspect input handling, subprocess execution, endpoint allowlist, response validation, attribution rules, partial/fatal semantics, Markdown escaping, output safety, tests, workflows, and documentation claims. Fix every confirmed high or medium severity issue with a failing regression test and a separate commit.

- [ ] **Step 2: Run the complete verification matrix again**

Run local `npm run check`, schema freshness, audit, package dry run, temporary install, fake integration tests, real public collection, and remote CI. Compare local and remote tag commits and verify a clean worktree.

- [ ] **Step 3: Record release evidence for application preparation**

Capture only public URLs and current observed facts: repository, release, CI run, security policy, example report, profile, license, and current stars/forks/contributors. Label small or zero metrics honestly. Do not turn initialization commits into claims of long-term maintenance.

## Completion Gate

The implementation and first-release plan is complete only when all of the following are true:

- `oss-evidence` works from a clean public release install on a supported Node version.
- Local checks and public CI pass on the release commit.
- The report contract, attribution rules, partial semantics, and limitations are documented and tested.
- The repository, release archive, example reports, security policy, and profile are publicly accessible.
- The public history contains the real design, implementation, review fixes, and release work without fabricated activity.
- An independent audit reports no unresolved high or medium severity issue.

Application drafting and submission begin only after this gate. The application must describe the project as it exists at submission time and must not claim guaranteed eligibility, established adoption, or long-term maintenance unless public evidence then supports those claims.
