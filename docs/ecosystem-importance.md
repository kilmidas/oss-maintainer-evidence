# Why Verifiable Maintainer Evidence Matters

As of 2026-07-20, this page explains the ecosystem problem that OSS Maintainer
Evidence is intended to address. It documents source-linked context, not
external adoption or program eligibility. The corresponding
[machine-readable ledger](ecosystem-importance.sources.json) records the claims,
source metadata, capability mappings, and limitations used on this page.

## Maintainer work needs traceable context

Linux Foundation Research interviewed open-source maintainers about their work
and published practices that include transparency, formal documentation, and
regular funding. That qualitative result supports documenting observable
maintenance clearly, but it does not show how common each practice is across all
maintainers. It also does not evaluate this project. See claim
`maintainer-practices` and source `lf-open-source-maintainers` in
[Open Source Maintainers](https://www.linuxfoundation.org/research/open-source-maintainers).

OSS Maintainer Evidence contributes a bounded record of public activity. It
cannot record all planning, mentoring, moderation, security, or community work,
and it does not assign economic value to the activity it can observe.

## Project-health measurement is established but contextual

The CHAOSS Starter Project Health Metrics Model presents time to first response,
change-request closure ratio, contributor concentration, and release frequency
as starting points for understanding project health. Those metrics require
denominators, time windows, contributor context, and interpretation. See claim
`project-health-measurement` and source `chaoss-starter-project-health` in the
[CHAOSS model](https://www.chaoss.community/starter-project-health-metrics-model/).

The current report exposes some related public events and release dates, but an
event list is not the corresponding health metric.

OSS Maintainer Evidence does not implement or certify the CHAOSS model.

## Automation can reduce evidence assembly work

OpenSSF describes Scorecard as an automated way to produce inspectable
security-practice signals that help users assess project risk and security
posture. This supports the narrower idea that repeatable evidence can reduce
manual assessment work. See claim `automated-inspectable-signals` and source
`openssf-scorecard` in the
[OpenSSF Scorecard documentation](https://openssf.org/scorecard/).

The two tools have different scopes. OSS Maintainer Evidence reports selected
maintenance activity and does not assess OpenSSF security posture. It does not
produce a security score or claim OpenSSF compatibility.

## Funding impact remains difficult to measure

A research paper on public funding for open-source development reports that
meaningful impact measurement lacks consensus. It recommends accounting for the
funding objective, project life stage, social structure, and other context. See
claim `funding-impact-measurement-gap` and source
`oss-funding-impact-toolkit` in
[A Toolkit for Measuring the Impacts of Public Funding on Open Source Software Development](https://arxiv.org/abs/2411.06027).

The public source does not establish its peer-review status, so the ledger marks
that status as unknown. A source-linked activity record can be one bounded input
to a wider qualitative or mixed-method assessment. It does not measure funding
outcomes, return on investment, or societal impact.

## What OSS Maintainer Evidence contributes

GitHub documents public endpoints for repository facts, contributors, releases,
issues, pull requests, reviews, comments, and repository content. The current
tool applies explicit [attribution rules](attribution.md) to selected fields and
retains canonical GitHub URLs for human inspection. See claim
`public-github-provenance` and the GitHub sources in the source ledger below.

The [public example](../examples/oss-maintainer-evidence.md) demonstrates the
current output contract. The relationship between that output and wider
measurement practices is deliberately limited:

| Evidence family | Coverage | Boundary |
| --- | --- | --- |
| Releases | Partial | Listed releases and dates are not a release-frequency assessment. |
| Authored and merged pull requests | Partial | Activity does not supply a complete closure ratio or project-health judgment. |
| Reviews | Partial | A submitted review does not establish review quality or contributor experience. |
| Opened and closed issues | Partial | Counts do not establish responsiveness, resolution quality, or complete triage work. |
| Issue comments | Partial | Comments are not classified as first human responses and do not establish response quality. |
| Repository facts | Direct provenance | Selected observed fields retain the canonical repository source URL. |
| Community files | Context only | File presence does not establish documentation quality, governance maturity, or compliance. |
| Adoption signals | Context only | Stars, forks, subscribers, and visible contributors are proxies, not proof of adoption or impact. |
| Evidence URLs | Direct provenance | Links support inspection of listed facts, not a judgment about their importance. |

## What the current release does not establish

This page does not demonstrate external adoption.

Repository activity alone does not establish social, economic, security, or
funding impact. The current release also does not establish:

- project health or sustainability;
- the quality or completeness of maintainer work;
- dependency criticality or downstream use;
- endorsement, certification, or standards compliance;
- funding outcomes or program eligibility; or
- the importance of this repository based on stars, downloads, or owner-run
  verification.

The broader collection limits remain documented in
[Known Limitations](limitations.md).

## Claim ledger

| Claim ID | Source IDs | Supported statement | Required limit |
| --- | --- | --- | --- |
| `maintainer-practices` | `lf-open-source-maintainers` | The qualitative study records transparency, formal documentation, and regular funding among practices shared by interviewed maintainers. | The study does not establish population prevalence or evaluate this project. |
| `project-health-measurement` | `chaoss-starter-project-health` | CHAOSS presents four starter project-health metrics. | The current tool exposes only partial inputs and does not calculate the model. |
| `automated-inspectable-signals` | `openssf-scorecard` | OpenSSF Scorecard automates inspectable security-practice signals. | Security assessment and maintenance evidence are different domains. |
| `funding-impact-measurement-gap` | `oss-funding-impact-toolkit` | The paper reports a measurement gap and recommends context-aware methods. | Review status is unknown, and the tool does not measure funding impact. |
| `public-github-provenance` | GitHub source IDs below | Documented public endpoints correspond to the evidence families collected by the tool. | Endpoint availability does not establish importance, completeness, or attribution. |

## Sources

All sources were accessed without publisher or GitHub login on the ledger date.
Publication dates are included only when the public source supplies one. The
source type and review status are recorded in the machine-readable ledger.

| Source ID | Publisher and title |
| --- | --- |
| `lf-open-source-maintainers` | Linux Foundation Research — [Open Source Maintainers](https://www.linuxfoundation.org/research/open-source-maintainers) |
| `chaoss-starter-project-health` | CHAOSS — [Starter Project Health Metrics Model](https://www.chaoss.community/starter-project-health-metrics-model/) |
| `openssf-scorecard` | Open Source Security Foundation — [Scorecard](https://openssf.org/scorecard/) |
| `oss-funding-impact-toolkit` | arXiv — [A Toolkit for Measuring the Impacts of Public Funding on Open Source Software Development](https://arxiv.org/abs/2411.06027) |
| `github-repository` | GitHub Docs — [Get a repository](https://docs.github.com/en/rest/repos/repos#get-a-repository) |
| `github-contributors` | GitHub Docs — [List repository contributors](https://docs.github.com/en/rest/repos/repos#list-repository-contributors) |
| `github-releases` | GitHub Docs — [List releases](https://docs.github.com/en/rest/releases/releases#list-releases) |
| `github-search-issues-pulls` | GitHub Docs — [Search issues and pull requests](https://docs.github.com/en/rest/search/search#search-issues-and-pull-requests) |
| `github-pull-detail` | GitHub Docs — [Get a pull request](https://docs.github.com/en/rest/pulls/pulls#get-a-pull-request) |
| `github-pull-reviews` | GitHub Docs — [List reviews for a pull request](https://docs.github.com/en/rest/pulls/reviews#list-reviews-for-a-pull-request) |
| `github-issue-detail` | GitHub Docs — [Get an issue](https://docs.github.com/en/rest/issues/issues#get-an-issue) |
| `github-issue-comments` | GitHub Docs — [List issue comments for a repository](https://docs.github.com/en/rest/issues/comments#list-issue-comments-for-a-repository) |
| `github-repository-content` | GitHub Docs — [Get repository content](https://docs.github.com/en/rest/repos/contents#get-repository-content) |
