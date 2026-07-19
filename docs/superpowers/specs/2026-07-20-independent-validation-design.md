# Independent validation design

## Goal

Make it easy for an independent maintainer to test a released OSS Maintainer Evidence archive on a public repository and provide safe, structured feedback without implying adoption, endorsement, or affiliation.

## Problem

The project has reproducible self-evidence, release artifacts, and strong safety documentation, but it does not yet provide a focused path for an outside maintainer to validate accuracy or workflow fit. General bug and feature forms do not capture the released version, result status, evidence accuracy, or sharing consent needed for independent validation.

## Chosen approach

Add a narrow validation guide and a dedicated GitHub issue form. Link both from the README and contributing guide. Improve package discovery metadata and explicitly package the public operating documents needed to interpret a report.

The workflow remains manual and opt-in:

1. Install a checksummed GitHub release.
2. Collect a report for one public repository.
3. Verify the JSON evidence links signed out.
4. Review the report before sharing anything.
5. Submit structured feedback; sharing the report itself is optional.

## Trust boundaries

- Validation uses only public GitHub.com data.
- Participants must not post tokens, private URLs, email addresses, application correspondence, or private reports.
- A self-run test is not external adoption.
- A validation issue is feedback, not endorsement or certification.
- Public attribution or an adopter listing requires explicit opt-in and is outside this change.
- The package remains private in npm metadata and is not published to a registry.

## Files

- `docs/independent-validation.md`: safe validation workflow and interpretation rules.
- `.github/ISSUE_TEMPLATE/validation.yml`: structured feedback form.
- `README.md`: visible invitation and honest roadmap.
- `CONTRIBUTING.md`: route validation feedback to the dedicated form.
- `package.json` and `package-lock.json`: discovery metadata and packaged public documents.
- `test/docs.test.ts` and `test/package-harness.test.ts`: documentation, safety, and package-metadata checks.

## Acceptance criteria

- A new user can find, run, verify, and report an independent validation from the README.
- The issue form requires released version, outcome, and data-safety confirmation.
- Documentation explicitly rejects adoption, endorsement, and affiliation inference.
- Package metadata has a description, homepage, keywords, and includes the public interpretation documents.
- `private: true` remains set and no registry publication automation is added.
- `npm run check`, schema validation, license validation, package verification, and an npm pack inspection pass.

