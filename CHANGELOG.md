# Changelog

All notable changes to this project are documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.1.0]: https://github.com/kilmidas/oss-maintainer-evidence/releases/tag/v0.1.0
