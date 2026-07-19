# Repository Agent Instructions

These rules apply to automated work in this repository.

## Required workflow

- Read the current plan, design, and nearby tests before changing behavior.
- Use test-driven development for behavior changes: add the failing test, observe the intended failure, then implement the minimum fix.
- Run `npm run check` before claiming completion.
- Keep changes focused and preserve user changes in a dirty worktree.

## Data and GitHub safety

- Use only public or synthetic test fixtures. Never add private repository content, credentials, application correspondence, tokens, cookies, authentication caches, or browser profiles.
- GitHub API access must remain `GET`-only through the endpoint allowlist and `gh api --hostname github.com`.
- Never add GitHub mutation commands, a shell subprocess, dynamic code execution, or token-reading behavior.
- Validate public-repository preflight, API responses, source URLs, pagination, and attribution before rendering.
- Fail closed for required evidence and represent optional uncertainty with structured limitations.

## External actions

- Human approval is required before creating a release, pushing to a new remote, changing repository settings, posting an external issue or comment, or submitting an application.
- Keep releases human-triggered. Do not add automatic registry publication.
- Summarize external targets and artifacts before requesting approval.
