# Independent Validation

Independent maintainers can use this workflow to check whether a released OSS Maintainer Evidence archive produces accurate, useful evidence for one public GitHub.com repository.

Completing this workflow does not demonstrate external adoption by itself. Participation does not imply endorsement or affiliation with this project, and a validation result is not a certification of the repository or maintainer.

## Before you run

- Use only a repository whose activity is already public on GitHub.com.
- Install a released archive rather than an unpublished branch.
- Do not include credentials, private URLs, non-public report data, email addresses, or application correspondence in public feedback.
- Review every generated title, username, timestamp, and URL before sharing it.

## Install a released archive

Download the `.tgz` archive and matching `.sha256` file from [Releases](https://github.com/kilmidas/oss-maintainer-evidence/releases). From the download directory, verify and install it:

```sh
shasum -a 256 -c oss-evidence-0.3.0.tgz.sha256
gh attestation verify oss-evidence-0.3.0.tgz \
  --repo kilmidas/oss-maintainer-evidence \
  --signer-workflow kilmidas/oss-maintainer-evidence/.github/workflows/release-artifacts.yml
npm install --global ./oss-evidence-0.3.0.tgz
oss-evidence --version
```

Collection requires GitHub CLI authenticated to `github.com`. The tool uses that access only for fixed, read-only `GET` requests and accepts only public repositories.

## Run from a public repository

Instead of installing locally, a maintainer can call the [reusable workflow](https://github.com/kilmidas/oss-maintainer-evidence/blob/main/.github/workflows/collect-evidence.yml) from their own public repository. Pin the caller to the documented 40-character commit SHA rather than a branch or tag, grant only `contents: read`, `issues: read`, and `pull-requests: read`, pass no secrets, and supply the public repository and maintainer inputs. The issue and pull-request scopes are required for the corresponding read-only GitHub REST endpoints; no write permission is needed.

The caller's GitHub Actions run uploads an `oss-maintainer-evidence` artifact containing `oss-evidence.json` and `verification.txt`. Download and review both files before sharing them. The automatically supplied token is limited to collection; verification clears token environment variables and checks public links signed out.

This path still uses only public GitHub.com data. A workflow run from this repository is a self-test, not independent validation. A run becomes independent feedback only when a separate maintainer chooses to execute it and reviews the result.

## Collect and verify

Choose a reporting window that reflects real maintenance work. The output path must not already exist.

```sh
oss-evidence collect owner/repository \
  --maintainer username \
  --since 90d \
  --format json \
  --output evidence.json

oss-evidence verify evidence.json
```

Record the released version, collection exit code, verification summary, and whether the report was complete or partial. A partial report can still be useful when its structured limitations accurately explain the missing evidence.

## Review accuracy

Check the report against the linked public GitHub pages:

1. Are activities attributed to the selected maintainer under the documented rules?
2. Are release, pull request, review, issue, and comment counts derived from listed activities?
3. Are missing or capped results recorded as limitations rather than zeros?
4. Do repository adoption values describe repository context without assigning individual credit?
5. Does signed-out verification reach the evidence links you expected?

## Share feedback

Open an [independent validation issue](https://github.com/kilmidas/oss-maintainer-evidence/issues/new?template=validation.yml) with the released version, outcome, accuracy notes, and workflow friction. Sharing the report is optional. A concise description of mismatches is enough, and you may replace repository and maintainer names with public placeholders when the exact identity is not useful to the report.

The project will not count maintainer self-tests, release verification downloads, or unconfirmed references as external adoption. Any future public adopter listing requires separate, explicit consent.
