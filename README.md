# OSS Maintainer Evidence

[![CI](https://github.com/kilmidas/oss-maintainer-evidence/actions/workflows/ci.yml/badge.svg)](https://github.com/kilmidas/oss-maintainer-evidence/actions/workflows/ci.yml)
[![CodeQL](https://github.com/kilmidas/oss-maintainer-evidence/actions/workflows/codeql.yml/badge.svg)](https://github.com/kilmidas/oss-maintainer-evidence/actions/workflows/codeql.yml)
[![Release](https://img.shields.io/github/v/release/kilmidas/oss-maintainer-evidence)](https://github.com/kilmidas/oss-maintainer-evidence/releases/latest)
[![License](https://img.shields.io/github/license/kilmidas/oss-maintainer-evidence)](https://github.com/kilmidas/oss-maintainer-evidence/blob/main/LICENSE)

OSS Maintainer Evidence is a local, read-only command-line tool that turns public GitHub maintenance activity into a source-linked Markdown or JSON report. It records releases, pull request work, reviews, issue work, community files, and observable adoption signals for one maintainer and one repository.

The report is evidence, not a verdict. The tool does not score or decide grant or program eligibility, and it does not predict whether an application will be accepted.

Read the [Ecosystem importance evidence](docs/ecosystem-importance.md) for the source-linked problem context, current capability mapping, and explicit limits.

## Requirements

- Node.js 22 or later
- A public GitHub repository

Collection also requires [GitHub CLI](https://cli.github.com/) authenticated to `github.com`. Verification does not require GitHub CLI authentication.

Authenticate with GitHub CLI before collecting evidence:

```sh
gh auth login --hostname github.com
gh auth status --hostname github.com
```

The application invokes `gh api` with fixed, read-only `GET` requests. It never reads or prints a token value. If an authenticated GitHub API request returns HTTP 5xx, the collector retries that same allowlisted public GET once without credentials, cookies, or redirects. It does not retry authentication, permission, or rate-limit failures through this path.

## Install

### From a GitHub release

For a quick version check without a global install:

```sh
npm exec --yes --package=https://github.com/kilmidas/oss-maintainer-evidence/releases/download/v0.3.0/oss-evidence-0.3.0.tgz -- oss-evidence --version
```

This convenience command does not automatically verify the archive checksum or build attestation. For a verified run, download the exact release assets, check both integrity records, and execute the downloaded local archive:

```sh
gh release download v0.3.0 --repo kilmidas/oss-maintainer-evidence \
  --pattern 'oss-evidence-0.3.0.tgz*'
shasum -a 256 -c oss-evidence-0.3.0.tgz.sha256
gh attestation verify oss-evidence-0.3.0.tgz \
  --repo kilmidas/oss-maintainer-evidence \
  --signer-workflow kilmidas/oss-maintainer-evidence/.github/workflows/release-artifacts.yml
npm exec --yes --package="$PWD/oss-evidence-0.3.0.tgz" -- oss-evidence --version
```

Expected output: `0.3.0`.

Release archives are distributed through GitHub Releases. Version `0.3.0` is not published to the npm registry.

### From source

```sh
git clone https://github.com/kilmidas/oss-maintainer-evidence.git
cd oss-maintainer-evidence
npm ci
npm run check
npm pack --ignore-scripts
npm install --global ./oss-evidence-0.3.0.tgz
```

## Usage

```text
Usage: oss-evidence collect owner/repository --maintainer username
       oss-evidence verify <report.json>

Options:
  --since <90d|ISO_TIMESTAMP>  Inclusive reporting-window start (default: 90d)
  --format <markdown|json>     Output format (default: markdown)
  --output <PATH>              Create a new output file instead of stdout
  --max-items <1..1000>        Maximum items per paginated resource (default: 200)
  --help                       Show command help
  --version                    Show the package version
```

Create a Markdown report on standard output:

```sh
oss-evidence collect owner/repository --maintainer username --since 90d
```

Create a new JSON file for a fixed inclusive window:

```sh
oss-evidence collect owner/repository \
  --maintainer username \
  --since 2026-01-01T00:00:00Z \
  --format json \
  --output evidence.json
```

An output path must not already exist. The command creates the file atomically and never overwrites an existing report.

Verify every public GitHub evidence link in a schema-version 1.0 JSON report without GitHub credentials, cookies, GitHub CLI state, or a browser profile:

```sh
oss-evidence verify evidence.json
```

Verification revalidates the full report, reads at most 5 MiB, checks at most 2,000 unique HTTP targets with bounded concurrency and timeouts, and follows only canonical same-host redirects. It prints one deterministic `PASS` or `FAIL` line per evidence URL and never prints response bodies or arbitrary response headers.

## GitHub Actions

An independent maintainer can call the reusable workflow from a public repository. Pin the workflow to the immutable commit below; the `v0.3.0` comment records the corresponding release without making the execution reference movable.

```yaml
name: Maintainer evidence

on:
  workflow_dispatch:

permissions:
  contents: read
  issues: read
  pull-requests: read

jobs:
  evidence:
    permissions:
      contents: read
      issues: read
      pull-requests: read
    uses: kilmidas/oss-maintainer-evidence/.github/workflows/collect-evidence.yml@64b5e58592d5cd6aa4012595682a9a51b76332bc # v0.3.0
    with:
      repository: owner/repository
      maintainer: username
      since: 90d
      max_items: 200
```

The caller repository supplies a read-only GitHub token with `contents`, `issues`, and `pull-requests` access and pays the GitHub Actions runner usage. These are the minimum token categories used by the repository, issue, and pull-request review endpoints; no write permission or user-managed secret is required. The called workflow checks out only its own immutable source, collects public data, verifies the report without authentication, and uploads an `oss-maintainer-evidence` artifact.

The following tag-based caller is shorter, but a tag can be moved. It is a convenience form and not the recommended security path:

```yaml
name: Maintainer evidence

on:
  workflow_dispatch:

permissions:
  contents: read
  issues: read
  pull-requests: read

jobs:
  evidence:
    permissions:
      contents: read
      issues: read
      pull-requests: read
    uses: kilmidas/oss-maintainer-evidence/.github/workflows/collect-evidence.yml@v0.3.0
    with:
      repository: owner/repository
      maintainer: username
```

The repository's scheduled self-smoke is not independent adoption, endorsement, or outside validation. It only checks that this public integration path still works.

## Report contents

A report contains:

1. Query identity and an inclusive UTC reporting window.
2. Repository facts and observation time.
3. Source-linked maintenance activities attributed by documented rules.
4. Counts calculated only from the listed evidence.
5. Community-file status and observable adoption values.
6. Pagination metadata and structured collection limitations.
7. An evidence URL appendix in Markdown output.

JSON output is validated against [schema/report-v1.json](schema/report-v1.json). See [attribution rules](docs/attribution.md) for the exact actor and timestamp requirements.

## Example reports

The latest reports were generated from the public v0.3.0 release and include its release, pull request, and issue trail:

- [v0.3.0 Markdown example](examples/oss-maintainer-evidence-v0.3.0.md)
- [v0.3.0 JSON example](examples/oss-maintainer-evidence-v0.3.0.json)

The v0.3.0 verifier reached all 28 unique evidence targets in the JSON example without supplied credentials. The two files come from separate collection invocations, so their observation timestamps differ slightly. Both preserve the repository's zero-star, zero-fork, zero-watcher values and two API-visible contributors, including automation, rather than implying external adoption.

The [v0.2.0 Markdown](examples/oss-maintainer-evidence-v0.2.0.md) and [v0.2.0 JSON](examples/oss-maintainer-evidence-v0.2.0.json) examples remain available as release history. The original [Markdown](examples/oss-maintainer-evidence.md) and [JSON](examples/oss-maintainer-evidence.json) examples remain available as the pre-v0.2.0 baseline.

## Independent validation

Independent maintainers can follow the [Independent validation](docs/independent-validation.md) workflow to install a released archive, collect a report for one public repository, verify its evidence links, and submit structured feedback. Sharing a generated report is optional.

Validation feedback helps find attribution gaps and workflow friction. It does not imply adoption, endorsement, certification, or affiliation, and the project does not count maintainer self-tests or release-verification downloads as external adoption.

## Exit codes

| Code | Meaning | Report emitted |
| --- | --- | --- |
| `0` | Complete report | Yes |
| `2` | Invalid input or unsupported repository scope | No |
| `3` | Required GitHub data could not be collected or validated | No |
| `4` | Report is valid but partial | Yes |
| `5` | Output could not be written safely | No |
| `6` | One or more evidence links failed signed-out verification | Verification results |

Treat exit `4` as a usable report that needs human review, not as an empty result.

## Public-data and privacy model

Version `0.3.0` collects only public GitHub.com data. It rejects private, internal, missing, and unsupported repositories during preflight. Authentication improves supported API access and rate limits but does not expand the product scope.

The verifier uses native HTTP requests rather than GitHub CLI or a browser. It supplies no authorization or cookie header and rejects redirects outside canonical public GitHub.com URLs.

Reports can contain public usernames, titles, timestamps, and URLs. Review a report before publishing it. Do not add private repository data, credentials, application correspondence, email addresses, or other non-public context to reports or fixtures.

## Architecture and safety

The CLI validates bounded input, builds collection requests from an endpoint allowlist, invokes GitHub CLI without a shell, validates every response, and applies transparent attribution rules. Its server-error recovery sends only the same public API GET with fixed non-secret headers, a timeout, an 8 MiB response cap, and no redirect following. Verification has a separate signed-out HTTP boundary with fixed headers, redirects, timeouts, and concurrency. Rendering occurs only after required collection succeeds, while optional endpoint gaps and pagination caps are recorded as limitations. See [architecture](docs/architecture.md) for the component boundaries.

The command has no GitHub mutation path, makes no AI API call, and does not infer activity from commit email, repository permission, labels, or title text.

## Limitations

The first release intentionally covers one public GitHub.com repository at a time. GitHub search caps, API visibility, missing actor fields, deleted accounts, and pagination limits can make a report partial. Repository counters describe the repository, not the maintainer. Full details and safe interpretation guidance are in [known limitations](docs/limitations.md).

## Roadmap

- Collect independent maintainer validation before broadening the data-provider scope.
- Turn reproducible validation feedback into focused fixes and maintenance releases.
- Add a machine-readable verification-result format after the text contract is stable.
- Evaluate additional public providers only after the GitHub contract is stable.
- Consider npm registry publication only after demand and publisher identity are established.

## Contributing and support

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Use [GitHub Issues](https://github.com/kilmidas/oss-maintainer-evidence/issues) for reproducible public bugs and feature requests, [SUPPORT.md](SUPPORT.md) for support boundaries, and [SECURITY.md](SECURITY.md) for private vulnerability reporting. Participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

Licensed under [Apache-2.0](LICENSE).
