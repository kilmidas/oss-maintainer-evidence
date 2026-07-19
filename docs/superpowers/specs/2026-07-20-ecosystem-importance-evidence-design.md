# Ecosystem Importance Evidence Design

**Status:** Owner approved  
**Date:** 2026-07-20  
**Scope:** Public, source-linked rationale for `oss-maintainer-evidence`

## Summary

The project will publish an auditable explanation of the ecosystem problem it
addresses. The explanation will connect each factual claim to a public primary
or empirical source, state how the current product relates to that claim, and
record the limits of the connection.

This work documents ecosystem importance. It does not claim project adoption,
endorsement, certification, funding impact, or eligibility for any program.
Small or zero adoption values remain disclosed separately and unchanged.

## Problem

The repository already proves that the tool exists, can be installed, and can
produce a source-linked maintenance report. It does not yet contain a similarly
auditable explanation of why verifiable maintainer-activity evidence matters to
the wider open-source ecosystem.

A conventional marketing page would be easy to overstate and difficult to
audit. The new evidence must therefore use the project's own trust model:

- observed statements are linked to their sources;
- the relationship between a source and the product is explicit;
- unsupported inferences are excluded;
- incomplete product coverage is named rather than implied away; and
- ecosystem importance is kept distinct from adoption.

## Goals

1. Publish a concise English-language ecosystem rationale for broad reuse.
2. Make every material external claim traceable to a public source.
3. Map the rationale to capabilities that exist in the current release.
4. Record non-covered metrics and methodological limits prominently.
5. Provide a machine-readable claim ledger that can be checked offline.
6. Verify that source links are reachable without GitHub or publisher login at
   the time the evidence is prepared.

## Non-Goals

- No claim that this repository is widely used, depended upon, or externally
  adopted.
- No claim that CHAOSS, GitHub, Linux Foundation, OpenSSF, or any cited author
  endorses this project.
- No claim that the report is a CHAOSS implementation, OpenSSF assessment, or
  compliance certification.
- No universal project-health score or maintainer-value score.
- No claim that repository activity alone measures social, economic, security,
  or funding impact.
- No automatic web scraping, publisher-specific integration, or background link
  monitoring.
- No application text or external form submission as part of this repository
  change.

## Deliverables

### Human-readable evidence page

Add `docs/ecosystem-importance.md` with these sections:

1. **Why maintainer evidence matters** — a short problem statement supported by
   maintainer and funding-impact research.
2. **Recognized measurement practices** — a careful comparison with community
   health and automated-assessment practices.
3. **What this tool contributes** — a capability map grounded in the current
   release.
4. **What this tool does not establish** — adoption, impact, health,
   endorsement, and certification limitations.
5. **Source ledger** — a readable list of source titles, publishers, dates,
   stable links, and access dates.

The README will link to this page from the existing purpose or evidence section.
The limitations documentation will link back to the page and retain the
adoption-versus-importance distinction.

### Machine-readable claim ledger

Add `docs/ecosystem-importance.sources.json` with this top-level contract:

```json
{
  "schemaVersion": "1.0",
  "asOf": "2026-07-20",
  "sources": [],
  "claims": [],
  "capabilityMappings": []
}
```

Each source contains:

- stable `id`;
- `title` and `publisher`;
- canonical HTTPS `url`;
- `publishedAt` when the publisher supplies it;
- `accessedAt`;
- `sourceType`, limited to `official-documentation`, `official-research`, or
  `research-paper`; and
- `reviewStatus`, limited to `peer-reviewed`, `not-peer-reviewed`,
  `not-applicable`, or `unknown`. Use `unknown` when public source metadata is
  insufficient; do not infer review from publisher reputation.

Each claim contains:

- stable `id`;
- a narrowly worded `statement`;
- one or more `sourceIds`;
- a `theme`, limited to `maintainer-role`, `measurement`, `automation`, or
  `funding-impact`;
- `projectRelevance`, explaining why the claim is relevant to this tool; and
- a non-empty `limitations` array.

Each capability mapping contains:

- `evidenceType`, limited to the current activity literals `release`,
  `authored_pull_request`, `merged_pull_request`, `review`, `opened_issue`,
  `closed_issue`, and `issue_comment`, or the report-level families
  `repository`, `community`, `adoption`, and `evidence_urls`;
- related `claimIds`;
- `coverage`, limited to `direct`, `partial`, or `context-only`;
- `implementationEvidence`, pointing to current public documentation, examples,
  or source paths; and
- `notes` describing missing dimensions.

The Markdown page is the narrative artifact. The JSON file is the review and
consistency artifact; neither file is generated from the other in this scope.

## Initial Source Set

The first version will use a small, high-quality set instead of collecting many
weak references:

1. **Linux Foundation Research, Open Source Maintainers**  
   `https://www.linuxfoundation.org/research/open-source-maintainers`  
   Supports the maintainer-role, transparency, documentation, and sustainable
   support context. The underlying study is qualitative and must not be treated
   as a population estimate.

2. **CHAOSS Starter Project Health Metrics Model**  
   `https://www.chaoss.community/starter-project-health-metrics-model/`  
   Supports the proposition that response time, change-request handling,
   contributor concentration, and release frequency are recognized project
   health signals. This project collects only a subset and does not implement or
   certify the CHAOSS model.

3. **OpenSSF Scorecard documentation**  
   `https://openssf.org/scorecard/`  
   Supports the value of automated, inspectable signals for informing user
   decisions. Scorecard assesses security practices; this project reports
   maintenance activity, so the relationship is contextual rather than
   equivalent.

4. **A Toolkit for Measuring the Impacts of Public Funding on Open Source
   Software Development**  
   `https://arxiv.org/abs/2411.06027`  
   Supports the measurement gap around open-source funding impact and the need
   to align evidence with goals, context, and project life stage. The source is
   labeled as a research paper, and its review status must be stated accurately.

5. **GitHub REST API documentation for the endpoint families used by the
   collector**

   Record each endpoint family as a separate source so a field-level provenance
   claim never points only to a broad API landing page:
   - repository facts:
     `https://docs.github.com/en/rest/repos/repos#get-a-repository`
   - visible contributors:
     `https://docs.github.com/en/rest/repos/repos#list-repository-contributors`
   - public releases:
     `https://docs.github.com/en/rest/releases/releases#list-releases`
   - issue and pull-request search candidates:
     `https://docs.github.com/en/rest/search/search#search-issues-and-pull-requests`
   - pull-request details:
     `https://docs.github.com/en/rest/pulls/pulls#get-a-pull-request`
   - pull-request reviews:
     `https://docs.github.com/en/rest/pulls/reviews#list-reviews-for-a-pull-request`
   - issue details:
     `https://docs.github.com/en/rest/issues/issues#get-an-issue`
   - issue comments:
     `https://docs.github.com/en/rest/issues/comments#list-issue-comments-for-a-repository`
   - community-file contents:
     `https://docs.github.com/en/rest/repos/contents#get-repository-content`

   These sources support only the provenance and availability of fields the
   tool collects. Each claim must cite the narrowest applicable source. GitHub
   documentation does not establish that those fields alone measure ecosystem
   impact.

Additional sources require a distinct claim that cannot be supported by this
set. Secondary summaries, search-result pages, press rewrites, and unsourced
marketing statistics are excluded.

## Claim-to-Capability Mapping

The public page will distinguish three relationship levels:

- **Direct:** the current report exposes the named observable activity or
  repository fact with a source URL.
- **Partial:** the current report exposes part of a recognized metric, but lacks
  a denominator, comparison period, population, or qualitative context.
- **Context only:** the source explains why measurement or automation matters,
  but the product does not implement the cited method.

Expected mappings include:

| Product evidence | Relationship | Required caveat |
| --- | --- | --- |
| Releases and release dates | Partial | A list is not a release-frequency health assessment. |
| Issues and issue comments | Partial | Activity counts do not establish response quality or complete triage work. |
| Pull requests and reviews | Partial | Counts do not establish review quality, contributor experience, or project health. |
| Visible contributors | Partial | Public contributor data does not establish a complete bus factor. |
| Community files | Context only | File presence does not establish policy quality or compliance. |
| Source-linked activity records | Direct | Provenance supports auditability, not the importance of the underlying work. |
| Stars, forks, and subscribers | Context only | These are disclosed proxies, not impact or adoption proof on their own. |

## Data Flow

1. A maintainer selects a narrowly scoped claim.
2. The claim is checked against an official or empirical source.
3. The claim, source metadata, relevance, and limitations are entered in the
   JSON ledger.
4. The narrative page paraphrases the same claim and cites the canonical source.
5. A validator checks the ledger contract and cross-references.
6. A separate manual link check verifies signed-out reachability and records the
   check date; transient network failures do not silently rewrite evidence.
7. Review confirms that each capability mapping points to behavior present in
   the current repository.

## Validation and Failure Behavior

Add an offline validator and tests with the following rules:

- unknown fields fail validation;
- duplicate identifiers fail validation;
- every claim references an existing source;
- every capability mapping references an existing claim;
- every source URL is HTTPS and belongs to the explicitly reviewed source set;
- every claim has at least one limitation;
- every mapping has implementation evidence and a coverage value;
- dates use `YYYY-MM-DD`;
- the validator performs no network access, reads no credentials, and mutates no
  external state.

Signed-out link reachability is a release-preparation check rather than a normal
unit test because publisher availability is nondeterministic. A failed link check
blocks publication of the evidence page until the URL is corrected or the source
is replaced; it does not cause an existing released CLI report to change.

## Trust and Writing Rules

- Paraphrase sources; do not reproduce long passages.
- Prefer the source's own title, publisher, publication date, and canonical URL.
- Label the source type and review status without guessing.
- Use absolute statements only when the cited source directly supports them.
- Use `can`, `helps`, or `is intended to` for product relevance; do not state
  outcomes that have not been observed.
- Keep current adoption values in their existing factual location and never use
  owner-generated downloads as external adoption.
- Include an explicit date so readers can judge staleness.
- Recheck sources before an application or a future release cites the page.

## Testing Strategy

1. Add fixtures for a valid ledger and each invalid cross-reference or enum.
2. Unit-test deterministic validation and stable, actionable error messages.
3. Run the validator against the committed ledger in `npm run check`.
4. Check that the Markdown page references every claim identifier or source
   identifier expected by the ledger.
5. Run the existing complete test suite, type check, lint, format check, package
   verification, dependency audit, and license check.
6. Manually request each canonical URL without authentication and record the
   status during final verification.

## Acceptance Criteria

The work is complete when:

- the public narrative and machine-readable ledger exist and agree;
- every factual ecosystem statement has a reviewed source;
- every product connection has an explicit coverage level and limitation;
- no text claims adoption, endorsement, certification, or eligibility;
- all implementation evidence points to current repository behavior;
- offline validation and the existing project checks pass;
- source links are reachable without authentication on the verification date;
- README and limitations documentation link to the evidence page; and
- the private application-readiness record is updated with the exact public
  commit and links after publication.

This evidence satisfies the repository's ecosystem-importance documentation
gate only. It does not satisfy the separate follow-up-release gate and does not
replace final application-field verification.

## Delivery Boundaries

Implementation will use a focused documentation-and-validation pull request.
No release is created in the same pull request. After merge, readiness is
reassessed separately. A later release must be justified by real product or
verification behavior, reviewed on its own, and explicitly documented in the
changelog.
