# Architecture

OSS Maintainer Evidence is a local Node.js CLI with explicit boundaries between untrusted input, GitHub responses, domain logic, and rendered output.

## Flow

1. The CLI parses a bounded repository name, maintainer, reporting window, format, output path, and item cap.
2. The runtime creates a GitHub client backed by a fixed `gh api --method GET --hostname github.com` process boundary.
3. An authenticated HTTP 5xx response triggers one signed-out retry of the same allowlisted public API GET. That request supplies fixed non-secret headers, rejects redirects, times out after 30 seconds, and reads at most 8 MiB. Authentication, permission, rate-limit, protocol, and validation failures do not use this recovery path.
4. Public-repository preflight runs before activity endpoints. Private, internal, missing, and noncanonical repository targets fail closed.
5. Typed endpoint contracts build every path and query. Pagination follows only validated next links that remain in the same endpoint family.
6. Collectors validate responses, apply the rules in [attribution.md](attribution.md), and return activities plus limitations.
7. The application assembles and validates the report. Required collection failures produce no report; optional gaps produce a valid partial report.
8. A deterministic Markdown or JSON renderer completes before stdout or a new atomic output file is written.

The verification flow is separate:

1. The CLI reads at most 5 MiB and strictly validates a schema-version 1.0 JSON report.
2. The domain layer extracts, sorts, de-duplicates, and groups at most 2,000 canonical public GitHub evidence targets.
3. Eight workers issue signed-out `GET` requests with fixed non-secret headers, ten-second timeouts, and at most five manual same-host redirects.
4. The application maps only validated status metadata to deterministic per-link results. Response bodies, arbitrary headers, and raw transport errors never reach output.

## Trust boundaries

- Command arguments are data, never shell syntax.
- The child process receives an argument array with `shell: false` and a bounded response size and timeout.
- The application does not read or print token values. GitHub CLI owns authentication.
- The server-error recovery request supplies no authorization or cookie header and cannot change the endpoint selected by the allowlist.
- All GitHub payloads and public URLs are validated before they enter the report.
- File output uses an exclusive temporary sibling and never replaces an existing path.
- Verification uses neither GitHub CLI nor browser state and supplies no authorization or cookie header.
- Verification redirects remain canonical `https://github.com` URLs without credentials, ports, queries, traversal, or fragments.

## Components

- `src/domain`: input and report schemas, aggregation, and stable types.
- `src/github`: endpoint registry, response schemas, pagination, collectors, and the server-only public API recovery boundary.
- `src/process`: the isolated GitHub CLI adapter.
- `src/app`: dependency construction and collection orchestration.
- `src/render`: deterministic Markdown and JSON output.
- `src/io`: stdout and safe file creation.
- `src/http`: the isolated signed-out public GitHub link adapter.

The project intentionally has no AI API dependency and no GitHub mutation client.
