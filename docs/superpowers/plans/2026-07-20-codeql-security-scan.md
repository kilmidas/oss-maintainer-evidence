# CodeQL Security Scan Implementation Plan

**Goal:** Add a reviewable, least-privilege CodeQL scan and public repository
health links without changing repository settings.

**Architecture:** A single pinned GitHub Actions workflow analyzes the
JavaScript and TypeScript source and uploads results with one narrowly scoped
write permission. Text-based policy tests lock the security boundary, and
README tests lock the reviewer-facing status links.

## Task 1: Lock the workflow contract

- Add `codeql.yml` to the required workflow set.
- Add the official CodeQL `v4.37.1` commit to the approved action set.
- Assert exact triggers, language, build mode, permissions, timeout, action
  count, immutable pins, and absence of shell commands or secrets.
- Run the focused workflow test and observe failure while the workflow is
  absent.

## Task 2: Implement the minimal scan

- Create `.github/workflows/codeql.yml` from the reviewed design.
- Run the focused workflow tests and require them to pass.
- Add CI and CodeQL badges and workflow links to `README.md`.
- Add documentation assertions for those exact public URLs.

## Task 3: Verify locally

- Run `npm run check`.
- Run schema, production dependency audit, license, and package checks.
- Review the diff for permissions, action pins, triggers, and unsupported
  security claims.

## Task 4: Verify publicly

- Push `security/add-codeql` and open a focused pull request.
- Wait for CI, dependency review, and CodeQL analysis to finish.
- Fix any confirmed alert or workflow failure before merging.
- Merge normally, wait for the default-branch CodeQL run, and verify the
  public workflow page and code-scanning analysis through signed-out or
  read-only checks.
