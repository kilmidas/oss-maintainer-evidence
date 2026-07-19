# Signed-out evidence verification design

## Goal

Add a real follow-up capability that checks whether every public GitHub evidence link in an `oss-evidence` JSON report is reachable without GitHub credentials, cookies, a browser profile, or GitHub CLI authentication.

The command is:

```text
oss-evidence verify <report.json>
```

This is a report-integrity check, not an availability guarantee and not proof that a reviewer will accept the evidence.

## Scope

Version 0.2.0 verifies JSON reports that conform to report schema version `1.0`. Markdown parsing, arbitrary URLs, private repositories, GitHub Enterprise, retry policy, configurable concurrency, and authenticated requests are out of scope.

The verifier reads at most 5 MiB, parses JSON, validates the full report with the existing strict Zod schema, and extracts:

- `repository.sourceUrl`;
- every activity `url`;
- every non-null community-file `sourceUrl`.

It sorts and de-duplicates evidence URLs. Fragment-bearing review and comment URLs remain distinct evidence links, while their fragment-free HTTP target is requested only once. A report with more than 2,000 distinct HTTP targets is rejected before any network request.

## Approaches considered

### Shell out to `curl`

This would be quick, but it creates a second subprocess boundary, makes redirect and header policy harder to prove, and conflicts with the repository rule against adding shell subprocess behavior. Rejected.

### Put `fetch` directly in the CLI

This has little code, but couples parsing, network policy, rendering, and process exit behavior. Tests would either require live network access or weak mocking. Rejected.

### Separate domain, transport, and CLI layers

The domain layer validates reports, extracts targets, and aggregates deterministic results. A narrow transport performs signed-out GitHub requests. The CLI owns file reading, rendering, and exit codes. Selected because each security boundary can be tested with synthetic data and an injected request function.

## Signed-out request policy

The built-in Node HTTP client sends `GET` requests with only explicit non-secret `Accept` and `User-Agent` headers. It never invokes `gh`, reads authentication state, supplies `Authorization` or `Cookie`, or uses browser storage.

Each request:

- starts from a URL already accepted by the report schema;
- removes the fragment before transport;
- allows at most five manual redirects;
- follows only canonical `https://github.com` URLs without credentials, a port, query parameters, path traversal, or an unsupported fragment;
- has a ten-second timeout;
- cancels the response body after reading status and redirect location.

Eight workers process unique targets concurrently. HTTP 200 through 299 is reachable. Redirect loops, missing or invalid locations, cross-host redirects, timeouts, transport failures, and every other HTTP status are failures. The implementation records safe reason codes and never emits response bodies or arbitrary headers.

## Output and exit behavior

Results are rendered in sorted evidence-URL order:

```text
PASS 200 https://github.com/acme/demo
FAIL http_404 https://github.com/acme/demo/issues/7
Verified 1 of 2 evidence links; 2 unique HTTP targets.
```

A successful verification exits `0`. Invalid invocation, unreadable or oversized input, invalid JSON, invalid report schema, or excessive target count exits `2` without making later requests. If at least one valid evidence link cannot be verified, the command still renders all results and exits `6`. Startup faults remain exit `1`.

The existing `collect` exit codes keep their meaning. Help, README, architecture, limitations, and changelog documentation describe the new command and its limits.

## Testing

Tests use only synthetic reports and an injected transport. They cover strict report validation, URL extraction and ordering, fragment grouping, same-host redirects, redirect loops, cross-host rejection, timeouts and transport failures, bounded concurrency, target limits, deterministic output, exit `0`, exit `2`, exit `6`, secret redaction, and regression of the existing collection path.

Live signed-out verification of the repository's checked-in example report is a release-time check, not a hermetic test.

## Release boundary

The user-visible command is a backward-compatible feature, so the justified follow-up release is `0.2.0`. The release remains human-triggered, contains a checksum sidecar, and does not publish to the npm registry.

Application preparation and submission are downstream operational work, not product behavior or repository content. They remain outside this feature's implementation boundary.
