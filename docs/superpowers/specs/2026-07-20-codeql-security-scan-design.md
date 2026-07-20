# CodeQL Security Scan Design

## Context

The repository already runs tests, dependency review, package audits, license
checks, and release provenance checks. It does not yet publish a first-party
code-scanning result in GitHub's security interface. A checked-in CodeQL
advanced setup keeps that control reviewable with the rest of the source and
does not require a repository-setting mutation.

## Goals

- Analyze the JavaScript and TypeScript source on changes to `main`, pull
  requests targeting `main`, and a weekly schedule.
- Upload results to GitHub code scanning with the smallest required token
  permissions.
- Pin every action to an immutable, reviewed commit.
- Expose the CI and code-scanning status from the repository landing page.
- Keep the workflow deterministic and free of downloaded scripts, secrets,
  package publication, or project-controlled shell commands.

## Non-goals

- Do not enable or change GitHub repository settings.
- Do not add third-party scoring, telemetry, or security services.
- Do not claim that a clean scan proves the absence of vulnerabilities.
- Do not add custom CodeQL queries before the default suite has a public
  baseline.

## Workflow

Create `.github/workflows/codeql.yml` with one bounded Ubuntu job for the
`javascript-typescript` language family. The workflow runs on pushes to
`main`, pull requests targeting `main`, and one weekly cron schedule. A
per-workflow and per-ref concurrency group cancels superseded scans.

The workflow-level token has only `contents: read`. The analysis job repeats
that permission and adds only `security-events: write`, which is required to
upload code-scanning results. It does not request `actions: read` because the
repository is public, or `packages: read` because no private CodeQL packs are
used.

The job checks out source without persisting credentials, initializes CodeQL
for `javascript-typescript` in `none` build mode, and analyzes it. Both CodeQL
steps use the verified commit behind the official `v4.37.1` release:
`7188fc363630916deb702c7fdcf4e481b751f97a`.

## Policy Enforcement

Static workflow tests require the file, immutable action pins, supported
triggers, exact language and build mode, bounded timeout, minimal permissions,
and the absence of shell steps, unsafe triggers, secrets, or write permissions
other than `security-events: write`.

Documentation tests require the README to link the public CI and CodeQL
workflow pages and badges. Existing signed-out link verification remains the
publication check for those links.

## Completion Evidence

Completion requires all local quality gates to pass, a pull request whose CI,
dependency review, and CodeQL jobs succeed, a normal merge to `main`, and a
successful CodeQL analysis visible on the default branch. Any real alert is
handled as a defect and summarized without exposing sensitive code or tokens.
