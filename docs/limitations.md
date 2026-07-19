# Known Limitations

Version `0.1.0` is deliberately narrow so every reported item has a transparent public source.

## Collection scope

- Only one public repository on GitHub.com is accepted per run. Public forks are accepted, but the report describes the fork rather than its upstream repository.
- Authentication is provided by GitHub CLI but does not expand the scope to private, internal, or enterprise repositories.
- Deleted users, hidden events, unavailable fields, and API permission differences can prevent attribution.
- Draft and unpublished releases are excluded.
- Standalone commits, tags, discussions, project boards, moderation, and work performed outside the supported API contract are not attributed.

## API limits

- GitHub search can report incomplete results and has a 1,000-result ceiling.
- Every paginated resource is bounded by `--max-items`; reaching the cap is recorded as truncation.
- Optional community-profile, security-file, or contributor endpoints can be unavailable. The report records that uncertainty instead of treating it as zero or absent.
- Contributor counts cover only the visible contributor response returned by the supported endpoint.

## Interpretation

A complete report means the requested contract completed without a recorded runtime collection gap. It does not mean that every maintenance action was observable. A partial report remains schema-valid and includes structured limitations, but it needs human review.

Counts are calculated only from listed activities. Stars, forks, watchers, contributors, and community files describe repository context, not individual maintainer credit. OSS Maintainer Evidence does not score or decide grant or program eligibility.

Review public usernames, titles, timestamps, and URLs before publishing a report. See [attribution.md](attribution.md) for exact inclusion rules and [architecture.md](architecture.md) for safety boundaries.
