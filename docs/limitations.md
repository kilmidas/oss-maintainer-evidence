# Known Limitations

Version `0.3.0` is deliberately narrow so every reported item has a transparent public source.

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
- An authenticated HTTP 5xx response gets one signed-out recovery request for the same allowlisted public API GET. The fallback has unauthenticated GitHub rate limits and does not apply to authentication, permission, or rate-limit failures.

## Interpretation

A complete report means the requested contract completed without a recorded runtime collection gap. It does not mean that every maintenance action was observable. A partial report remains schema-valid and includes structured limitations, but it needs human review.

Counts are calculated only from listed activities. Stars, forks, watchers, contributors, and community files describe repository context, not individual maintainer credit. OSS Maintainer Evidence does not score or decide grant or program eligibility.

The source-linked [ecosystem importance evidence](ecosystem-importance.md) explains why auditable maintainer activity can be useful context. It does not demonstrate external adoption, project impact, endorsement, certification, or program eligibility.

Review public usernames, titles, timestamps, and URLs before publishing a report. See [attribution.md](attribution.md) for exact inclusion rules and [architecture.md](architecture.md) for safety boundaries.

## Link verification

- Verification accepts only schema-version 1.0 JSON reports and public `https://github.com` evidence URLs. It does not parse Markdown, use authentication, or support private, enterprise, or arbitrary web targets.
- A successful check means the URL returned HTTP 200 through 299 at that moment without supplied credentials. It does not prove permanent availability, content correctness, reviewer acceptance, or ownership.
- Rate limiting, transient network failures, GitHub outages, or a later link change can produce a failed result. Link verification in Version `0.3.0` does not retry.
- Input is limited to 5 MiB and 2,000 unique HTTP targets. Requests use eight workers, a ten-second timeout per request, and at most five canonical same-host redirects.
