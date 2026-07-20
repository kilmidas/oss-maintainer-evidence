# Changelog

All notable changes to this project are documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-07-20

### Added

- A reusable read-only GitHub workflow collects and verifies public maintainer evidence without checking out caller code.
- The recommended caller pins the workflow to an immutable commit and forwards no user-managed secrets.
- A scheduled and manual self-smoke checks integration health without representing the run as external adoption.

### Documentation

- Added convenience and checksum-plus-attestation release execution paths.

## [0.2.0] - 2026-07-20

### Added

- `oss-evidence verify <report.json>` validates schema-version 1.0 reports and checks every source-linked public GitHub URL without credentials or cookies.
- Verification uses bounded file input, target count, concurrency, redirects, and request timeouts with deterministic per-link results.
- Unsafe redirects, unavailable links, transport failures, and timeouts produce fixed safe reason codes and exit `6` without exposing response bodies or error details.

### Documentation

- Added source-linked ecosystem importance context with a strict offline-validated evidence ledger.
- Documented verification trust boundaries, limitations, and release checks.

## [0.1.0] - 2026-07-19

### Added

- A local read-only CLI for public GitHub maintainer evidence.
- Markdown and schema-validated JSON report formats.
- Source-linked release, pull request, review, issue, and issue-comment attribution.
- Community readiness, public adoption signals, pagination metadata, and structured limitations.
- Safe GitHub CLI process isolation, deterministic output, and atomic no-overwrite file creation.
- Public contribution, conduct, security, support, and architecture documentation.

### Fixed

- Package installation verification now works with a fresh npm cache while lifecycle scripts remain disabled.
- Pull request and issue detail routes now accept positive safe numeric identifiers and reject invalid numeric values.

[0.3.0]: https://github.com/kilmidas/oss-maintainer-evidence/releases/tag/v0.3.0
[0.2.0]: https://github.com/kilmidas/oss-maintainer-evidence/releases/tag/v0.2.0
[0.1.0]: https://github.com/kilmidas/oss-maintainer-evidence/releases/tag/v0.1.0
