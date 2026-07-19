# OSS Maintainer Evidence

OSS Maintainer Evidence is a local, read-only command-line tool that turns public GitHub maintenance activity into a source-linked Markdown or JSON report. It records releases, pull request work, reviews, issue work, community files, and observable adoption signals for one maintainer and one repository.

The report is evidence, not a verdict. The tool does not score or decide grant or program eligibility, and it does not predict whether an application will be accepted.

Read the [Ecosystem importance evidence](docs/ecosystem-importance.md) for the source-linked problem context, current capability mapping, and explicit limits.

## Requirements

- Node.js 22 or later
- [GitHub CLI](https://cli.github.com/) authenticated to `github.com`
- A public GitHub repository

Authenticate with GitHub CLI before collecting evidence:

```sh
gh auth login --hostname github.com
gh auth status --hostname github.com
```

The application invokes `gh api` with fixed, read-only `GET` requests. It never reads or prints a token value.

## Install

### From a GitHub release

Download the `.tgz` archive and matching `.sha256` file from [Releases](https://github.com/kilmidas/oss-maintainer-evidence/releases). Verify the checksum before installing:

```sh
shasum -a 256 -c oss-evidence-0.1.0.tgz.sha256
npm install --global ./oss-evidence-0.1.0.tgz
```

Release archives are distributed through GitHub Releases. Version `0.1.0` is not published to the npm registry.

### From source

```sh
git clone https://github.com/kilmidas/oss-maintainer-evidence.git
cd oss-maintainer-evidence
npm ci
npm run check
npm pack --ignore-scripts
npm install --global ./oss-evidence-0.1.0.tgz
```

## Usage

```text
Usage: oss-evidence collect owner/repository --maintainer username

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

The repository includes real reports generated from its own public GitHub activity on 2026-07-19:

- [Markdown example](examples/oss-maintainer-evidence.md)
- [JSON example](examples/oss-maintainer-evidence.json)

The two files come from separate CLI invocations, so their observation timestamps differ slightly. Both preserve the repository's small or zero adoption values and link every listed activity to public source evidence.

## Exit codes

| Code | Meaning | Report emitted |
| --- | --- | --- |
| `0` | Complete report | Yes |
| `2` | Invalid input or unsupported repository scope | No |
| `3` | Required GitHub data could not be collected or validated | No |
| `4` | Report is valid but partial | Yes |
| `5` | Output could not be written safely | No |

Treat exit `4` as a usable report that needs human review, not as an empty result.

## Public-data and privacy model

Version `0.1.0` collects only public GitHub.com data. It rejects private, internal, missing, and unsupported repositories during preflight. Authentication improves supported API access and rate limits but does not expand the product scope.

Reports can contain public usernames, titles, timestamps, and URLs. Review a report before publishing it. Do not add private repository data, credentials, application correspondence, email addresses, or other non-public context to reports or fixtures.

## Architecture and safety

The CLI validates bounded input, builds requests from an endpoint allowlist, invokes GitHub CLI without a shell, validates every response, applies transparent attribution rules, and renders only after required collection succeeds. Optional endpoint gaps and pagination caps are recorded as limitations. See [architecture](docs/architecture.md) for the component boundaries.

The command has no GitHub mutation path, makes no AI API call, and does not infer activity from commit email, repository permission, labels, or title text.

## Limitations

The first release intentionally covers one public GitHub.com repository at a time. GitHub search caps, API visibility, missing actor fields, deleted accounts, and pagination limits can make a report partial. Repository counters describe the repository, not the maintainer. Full details and safe interpretation guidance are in [known limitations](docs/limitations.md).

## Roadmap

- Publish a follow-up report after a justified maintenance release.
- Add signed-out link verification for example evidence.
- Evaluate additional public providers only after the GitHub contract is stable.
- Consider npm registry publication only after demand and publisher identity are established.

## Contributing and support

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Use [GitHub Issues](https://github.com/kilmidas/oss-maintainer-evidence/issues) for reproducible public bugs and feature requests, [SUPPORT.md](SUPPORT.md) for support boundaries, and [SECURITY.md](SECURITY.md) for private vulnerability reporting. Participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

Licensed under [Apache-2.0](LICENSE).
