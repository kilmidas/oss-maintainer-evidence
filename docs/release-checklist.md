# 0.1.0 Release Checklist

Use this checklist from the exact commit proposed for release. The package remains private to npm; version `0.1.0` is distributed only through GitHub Releases.

## Release candidate

- [ ] Confirm `package.json` version `0.1.0` maps exactly to tag `v0.1.0`.
- [ ] Confirm local `main`, remote `main`, and the proposed release commit match.
- [ ] Run `npm ci` from a clean checkout.
- [ ] Run `npm run check` on Node.js 22 and 24 through public CI.
- [ ] Run `npm audit --omit=dev` and review any finding rather than suppressing it.
- [ ] Run `npm run license:check` and confirm every dependency expression is approved.
- [ ] Run `npm run package:verify` with a fresh npm cache.
- [ ] Run `npm pack --dry-run` and inspect the complete archive file list.
- [ ] Confirm the Markdown and JSON examples validate and contain only intended public data.
- [ ] Open every example evidence URL without authentication and require a successful response.
- [ ] Inspect the candidate diff and repository secret-scanning alerts; do not publish if any credential or private application data appears.

## Attested artifact

- [ ] Create and push only the annotated `v0.1.0` tag at the frozen release commit.
- [ ] Wait for `release-artifacts.yml` to finish successfully.
- [ ] Download the workflow-produced `.tgz`, checksum, and provenance data into a fresh temporary directory.
- [ ] Run `gh attestation verify --repo kilmidas/oss-maintainer-evidence` on the downloaded archive.
- [ ] Verify the recorded SHA-256 checksum before installing the archive.
- [ ] Compare the attested archive file list with the locally reproduced candidate.
- [ ] Install the archive in a clean directory and verify `--help`, `--version`, and one public JSON collection.

## Publish and recover

- [ ] Publish the GitHub release only after every earlier check passes; do not publish to npm.
- [ ] Attach only the verified workflow archive and checksum.
- [ ] Download the public assets again, repeat checksum and provenance verification, and smoke-test the public archive.
- [ ] Verify the repository, release, security policy, example reports, license, and passing CI links without relying on private credentials.
- [ ] If verification fails before publication, do not create the release; fix through a reviewed pull request and create a new frozen commit.
- [ ] If a published asset is wrong, remove the release from distribution, disclose the correction in a public issue, rebuild from a reviewed commit, and never move or silently replace the existing tag.
