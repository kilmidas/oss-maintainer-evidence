# 0.3.0 Release Checklist

Use this checklist from the exact commit proposed for release. The package remains private to npm; version `0.3.0` is distributed only through GitHub Releases.

## Release candidate

- [ ] Confirm `package.json` version `0.3.0` maps exactly to tag `v0.3.0`.
- [ ] Confirm local `main`, remote `main`, and the proposed release commit match.
- [ ] Run `npm ci` from a clean checkout.
- [ ] Run `npm run check` on Node.js 22 and 24 through public CI.
- [ ] Run `npm audit --omit=dev` and review any finding rather than suppressing it.
- [ ] Run `npm run license:check` and confirm every dependency expression is approved.
- [ ] Run `npm run package:verify` with a fresh npm cache.
- [ ] Run `npm pack --dry-run` and inspect the complete archive file list.
- [ ] Confirm the Markdown and JSON examples validate and contain only intended public data.
- [ ] Open every example evidence URL without authentication and require a successful response.
- [ ] Run `oss-evidence verify` on the example JSON report without passing credentials, cookies, GitHub CLI state, or browser state.
- [ ] Inspect the candidate diff and repository secret-scanning alerts; do not publish if any credential or private application data appears.
- [ ] Confirm the reusable workflow checks out `job.workflow_repository` at `job.workflow_sha`, never caller code, and grants only `contents: read`, `issues: read`, and `pull-requests: read`.
- [ ] Confirm the recommended caller documentation pins the reviewed immutable commit and forwards no secrets.

## Attested artifact

- [ ] Create and push only the annotated `v0.3.0` tag at the frozen release commit.
- [ ] Wait for `release-artifacts.yml` to finish successfully.
- [ ] Download the workflow-produced `.tgz` and checksum into a fresh temporary directory.
- [ ] Verify the GitHub-hosted provenance with `gh attestation verify --repo kilmidas/oss-maintainer-evidence` on the downloaded archive.
- [ ] Verify the recorded SHA-256 checksum before installing the archive.
- [ ] Compare the attested archive file list with the locally reproduced candidate.
- [ ] Install the archive in a clean directory and verify `--help`, `--version`, one public JSON collection, and signed-out verification of that report.
- [ ] Execute the documented public release URL through `npm exec` and require version `0.3.0`.

## Publish and recover

- [ ] Publish the GitHub release only after every earlier check passes; do not publish to npm.
- [ ] Attach only the verified workflow archive and checksum.
- [ ] Download the public assets again, repeat checksum and provenance verification, and smoke-test the public archive.
- [ ] Run `Evidence Smoke` manually on `main`, require success, and inspect its `oss-maintainer-evidence` artifact.
- [ ] Record that the scheduled self-smoke checks integration health only and is not independent adoption or endorsement.
- [ ] Verify the repository, release, security policy, example reports, license, and passing CI links without relying on private credentials.
- [ ] If verification fails before publication, do not create the release; fix through a reviewed pull request and create a new frozen commit.
- [ ] If a published asset is wrong, remove the release from distribution, disclose the correction in a public issue, rebuild from a reviewed commit, and never move or silently replace the existing tag.
