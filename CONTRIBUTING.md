# Contributing

Thank you for helping improve OSS Maintainer Evidence. Keep changes small, reviewable, and grounded in reproducible public GitHub data.

## Before opening work

1. Search [existing issues](https://github.com/kilmidas/oss-maintainer-evidence/issues).
2. Open a bug or feature issue when behavior or scope needs agreement.
3. Never post tokens, private repository data, internal URLs, application correspondence, or personal information.
4. For a vulnerability, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Local setup

Use Node.js 22 or later:

```sh
npm ci
npm run check
```

For behavior changes, add a failing test first. Fixtures must be synthetic or copied only from already-public responses after removing irrelevant personal data. Tests must not depend on live GitHub state.

## Development rules

- Keep GitHub access `GET`-only and use the typed endpoint allowlist.
- Invoke subprocesses with argument arrays and without a shell.
- Never read, log, snapshot, or commit authentication tokens.
- Preserve public-repository preflight and required-data fail-closed behavior.
- Record uncertainty as a structured limitation instead of guessing.
- Keep output deterministic and retain source URLs for attributed evidence.
- Do not broaden scope to private or enterprise repositories without an approved design change.

## Pull requests

Create a focused branch and submit a small pull request with:

- the user-visible problem and chosen behavior;
- tests that failed before the change and pass afterward;
- documentation updates for public behavior;
- only public or synthetic reproduction data;
- confirmation that `npm run check` passes.

Maintainers may ask to split unrelated changes. By contributing, you agree that your contribution is licensed under Apache-2.0 and that you will follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
