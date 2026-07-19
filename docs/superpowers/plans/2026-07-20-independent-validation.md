# Independent validation implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe independent-validation path and distribution metadata without claiming adoption or publishing to npm.

**Architecture:** Keep the runtime unchanged. Add a documentation workflow and GitHub issue form, enforce their trust language with documentation tests, and improve package metadata while retaining `private: true`.

**Tech stack:** Markdown, GitHub issue forms, npm package metadata, TypeScript tests with the Node test runner.

---

### Task 1: Lock the public validation contract with tests

**Files:**

- Modify: `test/docs.test.ts`
- Modify: `test/package-harness.test.ts`

- [ ] Add assertions for the guide, issue form, README route, required safety language, package discovery metadata, packaged public documents, and retained private status.
- [ ] Run the focused documentation and package tests and confirm they fail for missing content.

### Task 2: Add the independent-validation workflow

**Files:**

- Create: `docs/independent-validation.md`
- Create: `.github/ISSUE_TEMPLATE/validation.yml`
- Modify: `README.md`
- Modify: `CONTRIBUTING.md`

- [ ] Document install, collect, verify, review, and optional feedback steps using only public data.
- [ ] Add a structured issue form that requires version, outcome, and safety confirmation.
- [ ] Replace completed roadmap work with independent validation and feedback-driven maintenance goals.
- [ ] Re-run focused tests and confirm they pass.

### Task 3: Improve distribution metadata without publishing

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] Add description, homepage, keywords, and selected public docs to package files while retaining `private: true`.
- [ ] Refresh lockfile root metadata without changing dependency versions.
- [ ] Run focused package tests and inspect `npm pack --dry-run --json`.

### Task 4: Verify and deliver through normal review

- [ ] Run `npm run check`, `npm run schema:check`, `npm audit --omit=dev`, `npm run license:check`, and `npm run package:verify`.
- [ ] Review the diff for unsupported adoption claims, private data, or runtime-scope changes.
- [ ] Commit the focused change, push the existing remote branch, open a pull request, and merge only after required checks pass.
- [ ] Do not publish a registry package, create a release, alter repository settings, or manufacture external feedback.

