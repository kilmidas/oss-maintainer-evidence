# OSS Maintainer Evidence Design

**Status:** Owner approved
**Date:** 2026-07-19  
**Working repository name:** `oss-maintainer-evidence`  
**CLI name:** `oss-evidence`

## Summary

OSS Maintainer Evidence is a local-first, read-only command-line tool that turns public GitHub activity into a source-linked evidence pack. It helps open-source maintainers document work that is otherwise difficult to summarize: pull request review, issue triage, releases, repository health work, and adoption signals.

The first release will run on a maintainer's personal computer, use the existing GitHub CLI authentication flow, and produce Markdown and JSON. It will not call an AI API, mutate GitHub state, assign an eligibility score, or claim that a user qualifies for any funding program. Codex will be used locally to build and maintain the project, review changes, write tests, update documentation, and prepare releases.

## Why the Direction Changed

The initially proposed name and scope, `maintainer-pulse`, conflicts with a recently published tool that already produces actionable issue and pull request maintenance reports. Other existing projects also automate repository triage and stewardship. Reproducing those features would add little ecosystem value.

This design instead focuses on retrospective, verifiable evidence of maintainer work. The output is useful for project updates, sponsorship pages, grant applications, governance handoffs, and sustainability reports. Every material statement in the report must be traceable to a GitHub URL or explicitly marked as an inference or unavailable signal.

## Goals

1. Generate a concise, source-linked record of maintainer activity for one public GitHub repository.
2. Separate observed facts, calculated summaries, and unavailable evidence.
3. Make the tool safe to run on a personal computer without storing GitHub tokens.
4. Provide stable Markdown for human review and JSON for downstream tooling.
5. Establish a credible, maintainable public project with tests, releases, contribution guidance, and transparent limitations.

## Non-Goals

- No automatic issue closing, labeling, commenting, merging, or other GitHub writes.
- No AI-generated eligibility decision or acceptance prediction.
- No fabricated stars, downloads, contributors, activity, or historical data.
- No OpenAI API integration in the first release.
- No hosted service, database, browser dashboard, or user account system.
- No private or corporate repository support in the first release.
- No copying of code, data, workflows, or documentation from an internal repository.

## Primary User Flow

1. The maintainer installs Node.js 22 or newer and GitHub CLI.
2. The maintainer authenticates GitHub CLI through GitHub's supported login flow.
3. From any terminal, the maintainer runs:

   ```text
   oss-evidence collect owner/repository --maintainer username --since 90d
   ```

4. The CLI validates the repository and maintainer names, forces the GitHub.com host, rejects any repository that is not public, fetches public data through `gh api`, normalizes the responses, and calculates transparent summaries.
5. The CLI writes one selected format to standard output, or to the path supplied with `--output`.
6. The maintainer reviews the report and follows its source links. The tool never submits the report or changes GitHub.

## First-Release Scope

### Inputs

- Required repository in `owner/name` form.
- Required maintainer GitHub username.
- Optional reporting window using `--since`, defaulting to 90 days.
- Optional `--format markdown|json`, defaulting to Markdown. One invocation produces one format.
- Optional `--output <path>`.
- Optional `--max-items <number>`, defaulting to 200 per paginated resource and capped at 1,000.

Configuration files are intentionally excluded from the first release. A small explicit command surface is easier to document, test, and audit.

### Evidence Collected

The tool will collect only evidence available for a public repository on GitHub.com. GitHub CLI authentication is used for supported API access and rate limits, but it does not expand the product scope to private, internal, or enterprise repositories:

- Repository facts: visibility, description, license, creation date, latest push, default branch, `stargazers_count`, `forks_count`, `subscribers_count`, open issue count, and archived state.
- Release work: public, published releases authored by the maintainer within the reporting window, with source URLs and dates. Draft releases are excluded. A release-associated tag is shown as release metadata; standalone tags are not attributed to a maintainer.
- Pull request work: pull requests authored by the maintainer, pull requests merged by the maintainer, and submitted reviews authored by the maintainer within the reporting window.
- Issue work: issues opened by the maintainer, issues closed by the maintainer, and issue comments authored by the maintainer within the reporting window. Label changes and other implied triage actions are not attributed in the first release.
- Community health signals: presence of README, license, contributing guide, security policy, code of conduct, issue templates, and pull request template.
- Adoption proxies: stars from `stargazers_count`, forks from `forks_count`, repository subscribers from `subscribers_count`, and contributors visible through GitHub. Package registry links and download counts are excluded from the first release because they require registry-specific provenance rules.

GitHub APIs do not expose every kind of maintainer labor in a complete or uniform way. Missing review, triage, permission, or download data must be reported as unavailable, not treated as zero.

### Attribution and Time Rules

GitHub usernames are compared case-insensitively and preserved in their API-provided form for display. The reporting window is inclusive: an event is included when its event-specific timestamp is greater than or equal to `since` and less than or equal to the collection start time, all normalized to UTC.

The first release uses only these attribution rules:

- Release: `release.author.login` matches the maintainer, `draft` is `false`, and `published_at` is present and inside the reporting window. Unpublished and draft releases are excluded rather than reported from authenticated-only data.
- Authored pull request: `pull.user.login` matches; time is `created_at`.
- Merged pull request: `pull.merged_by.login` matches; time is `merged_at`. A pull request merely merged during the window is not maintainer evidence when another actor merged it.
- Pull request review: `review.user.login` matches and the review has a submitted state; time is `submitted_at`.
- Opened issue: `issue.user.login` matches; time is `created_at`.
- Closed issue: `issue.closed_by.login` matches; time is `closed_at`.
- Issue comment: `comment.user.login` matches; time is `created_at`.

Repository facts, community files, and adoption signals describe the repository and are never presented as actions performed by the maintainer. Events lacking the required actor or timestamp remain unavailable and generate a limitation entry; they are not guessed from commit names, email addresses, labels, or repository permissions.

### Output Sections

The Markdown report will contain:

1. Report identity: repository, maintainer, collection time, reporting window, tool version.
2. Repository facts: direct API facts with source links.
3. Maintenance activity: dated, linked events grouped by releases, pull requests, reviews, and issues.
4. Activity summary: deterministic counts derived from the listed events.
5. Community readiness: presence or absence of standard community files.
6. Adoption signals: only observable public values, with collection dates.
7. Limitations: truncated pages, unavailable endpoints, permission gaps, and known attribution limits.
8. Evidence appendix: canonical URLs for every collected event.

The JSON output will contain these required top-level fields:

- `schemaVersion`: starts at `1.0`.
- `generatedAt`: UTC collection start time.
- `status`: `complete` or `partial`.
- `query`: repository, maintainer, inclusive `since` and `until`, and `maxItems`.
- `repository`: observed repository facts, source URL, and observation time.
- `activities`: arrays for releases, authored pull requests, merged pull requests, reviews, opened issues, closed issues, and issue comments.
- `summary`: counts derived only from the corresponding activity arrays.
- `community`: each expected file represented as `present`, `absent`, or `unavailable` with a source URL when present.
- `adoption`: observed values and observation time. Unknown values are `null`, never zero.
- `pagination`: fetched count and `truncated` flag for every paginated resource.
- `limitations`: structured entries with a stable code, affected resource, and human-readable message.

Every activity item requires `id`, `type`, `actor`, `occurredAt`, `url`, `title`, and `attributionRule`. A runtime collection gap or truncation sets `status` to `partial`. An API limitation that is explicitly outside the first-release collection contract is documented but does not by itself change a successfully collected report from `complete` to `partial`.

## Architecture

The project will use TypeScript on Node.js 22 or newer. Node.js 20 reached end of life before this project's first release and is therefore outside the supported runtime matrix. The runtime will be split into focused modules:

1. **CLI layer** parses arguments, validates bounded inputs, selects a renderer, and maps errors to exit codes.
2. **GitHub CLI adapter** invokes `gh api --hostname github.com` with an argument array and `shell: false`. It owns public-repository preflight, pagination, timeouts, and error translation. No token value is read or printed by the application.
3. **Normalization layer** converts GitHub response shapes into small internal evidence records with timestamps, actors, event types, and source URLs.
4. **Attribution layer** applies documented rules for deciding whether an event is attributable to the requested maintainer. Ambiguous events remain unclassified.
5. **Aggregation layer** calculates counts only from normalized records included in the report.
6. **Markdown renderer** produces a readable evidence pack with stable headings and links.
7. **JSON renderer** produces a versioned machine-readable document.

The GitHub adapter and process executor will be dependency-injected so tests can use fixtures without network access or a real GitHub login.

## Data and Trust Boundaries

- Repository names and usernames are untrusted input and must match conservative GitHub identifier patterns before being passed to another process.
- Input accepts only `owner/name`, not arbitrary URLs or hostnames. All API calls are forced to `github.com`.
- Before any activity endpoint is queried, repository metadata must report `private: false`, `visibility: public`, and a canonical GitHub.com URL. Private, internal, missing, and GitHub Enterprise repositories are rejected.
- Authenticated-only draft release metadata is discarded, and every reported evidence URL must be a public GitHub.com URL that a signed-out reader can open.
- `gh` is executed directly with an argument array. Shell interpolation is prohibited.
- GitHub response text is untrusted. Renderers must escape Markdown control sequences where needed and must never execute repository content.
- The CLI uses read endpoints only. A test will fail if the adapter introduces non-read HTTP methods.
- Standard output and error output must redact any value that resembles a token or authorization header.
- Reports may contain public usernames and URLs. The README will tell users to review reports before publishing them.

## Error Handling and Exit Codes

- Exit `0`: complete report generated.
- Exit `2`: invalid command input, unsupported option, or a repository outside the public GitHub.com scope.
- Exit `3`: GitHub CLI missing, unauthenticated, repository preflight failure, network failure, rate limit, or failure of a required activity endpoint. No report is emitted because activity counts could be misleading.
- Exit `4`: core repository and activity collection succeeded, but an optional endpoint failed or a paginated resource was truncated by `--max-items`. A report is emitted with `status: partial` and a prominent partial-data warning.
- Exit `5`: output file could not be written.

An expected absence, such as a repository having no security policy, is a collected fact and does not cause exit `4`. Data that GitHub does not expose under the documented first-release contract is a limitation and does not cause exit `4`. Errors must name the failed operation and give one safe corrective action. Raw response headers, tokens, environment variables, and complete command environments must not be printed.

## Testing Strategy

### Unit Tests

- Argument and identifier validation.
- Date-window parsing and boundary cases.
- Event attribution rules, including ambiguous actors.
- Exclusion of draft and unpublished releases even when fixtures simulate authenticated access.
- Aggregation from normalized records.
- Markdown escaping and stable report sections.
- JSON schema version and deterministic serialization.
- Secret redaction.

### Adapter Tests

- Fixture-driven pagination.
- Rate-limit, authentication, network, timeout, and partial-page errors.
- Verification that subprocess execution uses `shell: false` and argument arrays.
- Verification that only read operations are permitted.

### Integration Tests

- Run the compiled CLI against a fake `gh` executable backed by recorded, redacted fixtures.
- Generate Markdown and JSON golden files.
- Confirm identical input produces identical normalized output apart from the explicit collection timestamp.

### Release Verification

- Clean install on supported Node.js versions.
- `--help` and `--version` smoke tests.
- A public sample report generated from this repository.
- Dependency audit and license check.
- Continuous integration must pass before a release tag is created.

## Public Repository Standards

Before version `0.1.0`, the repository will include:

- English README with purpose, non-goals, installation, example output, privacy model, and limitations.
- Apache-2.0 license.
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, and support policy.
- Issue forms for bugs and feature requests, plus a pull request template.
- Architecture and evidence-attribution documentation.
- Automated tests, formatting, type checking, dependency review, and continuous integration.
- A changelog and signed or GitHub-attested release artifacts where the available publishing workflow supports them.
- An `AGENTS.md` documenting local Codex development commands, review expectations, and safety rules.

The public documentation will be written in English for broad reuse. User-facing coordination and application review with the repository owner will remain in Korean.

## Codex Maintenance Workflow

The repository owner will use Codex directly on a personal computer for legitimate project maintenance:

- Turn public issues into scoped implementation plans.
- Implement and test fixes in isolated branches or worktrees.
- Review diffs and identify regressions before a pull request is merged.
- Maintain fixture coverage when GitHub response shapes change.
- Update user documentation and the changelog with releases.
- Draft release notes that the maintainer reviews before publication.
- Triage reported defects and reproduce them locally.

Codex remains an assistant. The human maintainer approves repository writes, releases, external comments, and security-sensitive decisions.

## Application Readiness Gate

Publishing the repository does not itself make the owner eligible for an open-source support program. The application will wait until the public repository shows honest evidence of active maintenance. Readiness requires all of the following, without inventing a universal minimum star or time threshold:

- A working release that another person can install and reproduce.
- Passing public continuous integration and documented security practices.
- More than a one-time initialization commit, with real issue, fix, review, and release history.
- At least one public example showing the tool used for its stated purpose.
- Current, source-linked adoption or ecosystem-importance evidence, even if the project remains small.
- An accurate statement of the owner's primary-maintainer role.
- An application description that distinguishes local Codex use from optional API-credit use.

Stars, followers, downloads, contributors, and activity will never be purchased, automated, exchanged, or misrepresented.

## Delivery Phases

The implementation plan produced from this design covers only phases 1 and 2 through version `0.1.0`:

1. **Foundation:** project structure, CLI contract, safe GitHub adapter, fixtures, renderers, tests, community files, and continuous integration.
2. **First public release:** sample evidence pack, installation path, release notes, package publication if the package name remains available, and profile pinning.

The following are operating phases after the first implementation plan, not additional product subsystems:

3. **Real maintenance:** use the tool on its own repository, handle genuine issues, publish fixes and follow-up releases, and improve documentation from user feedback.
4. **Application preparation:** collect current metrics, draft the three 500-character responses, verify the ChatGPT account email and OpenAI organization identifier, fill the form, and stop for owner approval before submission.

## Open Decisions Deferred Until Implementation Planning

These are bounded choices, not missing product requirements:

- Confirm that the GitHub repository name `oss-maintainer-evidence` is available immediately before creation.
- Confirm an available npm package name; otherwise publish under a scoped package such as `@kilmidas/oss-evidence`.
- Select the smallest maintained libraries for argument parsing, validation, and testing after checking current Node.js compatibility.

No other first-release functionality is intentionally left unspecified.
