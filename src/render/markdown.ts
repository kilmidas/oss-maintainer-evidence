import { type Report, reportSchema } from "../domain/report.js";

const clean = (value: string) =>
  Array.from(value, (character) => {
    const code = character.codePointAt(0) ?? 0;
    return code <= 0x1f || (code >= 0x7f && code <= 0x9f) ? " " : character;
  })
    .join("")
    .replace(/\s+/g, " ")
    .trim();

export const escapeMarkdown = (value: string) =>
  clean(value)
    .replace(/\\/g, "\\\\")
    .replace(/([`*_{}[\]()#+\-.!|>])/g, "\\$1")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const link = (label: string, url: string) =>
  `[${escapeMarkdown(label)}](${url})`;

const activityLabels = {
  releases: "Releases",
  authoredPullRequests: "Authored pull requests",
  mergedPullRequests: "Merged pull requests",
  reviews: "Pull request reviews",
  openedIssues: "Opened issues",
  closedIssues: "Closed issues",
  issueComments: "Issue comments",
} as const;

const activityRows = (report: Report) => {
  const lines: string[] = [];
  for (const [key, label] of Object.entries(activityLabels)) {
    const values = (
      report.activities as unknown as Record<
        string,
        Array<{
          actor: string;
          occurredAt: string;
          title: string;
          url: string;
          attributionRule: string;
        }>
      >
    )[key];
    lines.push(`### ${label}`, "");
    if (values.length === 0) {
      lines.push(
        `No ${label.toLowerCase()} found in the reporting window.`,
        "",
      );
      continue;
    }
    for (const item of values)
      lines.push(
        `- ${item.occurredAt} — ${link(item.title, item.url)} by ${escapeMarkdown(item.actor)} (${escapeMarkdown(item.attributionRule)})`,
      );
    lines.push("");
  }
  return lines;
};

export function renderMarkdown(value: Report): string {
  const report = reportSchema.parse(value);
  const lines = ["# OSS Maintainer Evidence", ""];
  if (report.status === "partial")
    lines.push(
      "> **Partial report:** One or more optional resources were unavailable or truncated. Review the limitations before using these results.",
      "",
    );
  lines.push(
    "## 1. Report Identity",
    "",
    `- Repository: ${link(report.query.repository.fullName, report.repository.sourceUrl)}`,
    `- Maintainer: ${escapeMarkdown(report.query.maintainer)}`,
    `- Generated at: ${report.generatedAt}`,
    `- Reporting window: ${report.query.since} through ${report.query.until} (inclusive)`,
    `- Schema version: ${report.schemaVersion}`,
    "",
    "## 2. Repository Facts",
    "",
    `- Description: ${report.repository.description === null ? "Unavailable" : escapeMarkdown(report.repository.description)}`,
    `- Observed at: ${report.repository.observedAt}`,
    `- Source: ${link("GitHub repository", report.repository.sourceUrl)}`,
    "",
    "## 3. Maintenance Activity",
    "",
    ...activityRows(report),
    "## 4. Activity Summary",
    "",
    "Counts below are calculated from the listed evidence items.",
    "",
  );
  for (const [key, label] of Object.entries(activityLabels))
    lines.push(
      `- ${label}: ${(report.summary as unknown as Record<string, number>)[key]}`,
    );
  lines.push(
    `- Total: ${report.summary.total}`,
    "",
    "## 5. Community Readiness",
    "",
  );
  const communityEntries = Object.entries(report.community).sort(([a], [b]) =>
    a.localeCompare(b, "en"),
  );
  if (communityEntries.length === 0)
    lines.push("No community metadata was returned.");
  for (const [name, state] of communityEntries) {
    const suffix =
      state.status === "present" ? ` — ${link("source", state.sourceUrl)}` : "";
    lines.push(
      `- ${escapeMarkdown(name)}: ${escapeMarkdown(state.status)}${suffix}`,
    );
  }
  lines.push(
    "",
    "## 6. Adoption Signals",
    "",
    `- Stars: ${report.adoption.stars ?? "Unavailable"}`,
    `- Forks: ${report.adoption.forks ?? "Unavailable"}`,
    `- Watchers: ${report.adoption.watchers ?? "Unavailable"}`,
    `- Visible contributors: ${report.adoption.contributors ?? "Unavailable"}`,
    `- Observed at: ${report.adoption.observedAt ?? "Unavailable"}`,
    "",
    "## 7. Limitations",
    "",
  );
  if (report.limitations.length === 0)
    lines.push("No runtime collection limitations were recorded.");
  for (const item of report.limitations)
    lines.push(
      `- **${escapeMarkdown(item.code)}** (${escapeMarkdown(item.resource)}): ${escapeMarkdown(item.message)}`,
    );
  const evidenceUrls = new Set<string>([report.repository.sourceUrl]);
  for (const values of Object.values(
    report.activities as unknown as Record<string, Array<{ url: string }>>,
  ))
    for (const item of values) evidenceUrls.add(item.url);
  for (const state of Object.values(report.community))
    if (state.status === "present") evidenceUrls.add(state.sourceUrl);
  lines.push("", "## 8. Evidence Appendix", "");
  for (const url of [...evidenceUrls].sort((a, b) => a.localeCompare(b, "en")))
    lines.push(`- ${url}`);
  return `${lines.join("\n").trimEnd()}\n`;
}
