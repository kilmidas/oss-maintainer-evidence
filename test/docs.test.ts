import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (path: string) => readFileSync(resolve(projectRoot, path), "utf8");

const requiredFiles = [
  "README.md",
  "LICENSE",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  "SECURITY.md",
  "SUPPORT.md",
  "CHANGELOG.md",
  "AGENTS.md",
  "docs/architecture.md",
  "docs/attribution.md",
  "docs/ecosystem-importance.md",
  "docs/ecosystem-importance.sources.json",
  "docs/limitations.md",
  ".github/ISSUE_TEMPLATE/bug.yml",
  ".github/ISSUE_TEMPLATE/feature.yml",
  ".github/ISSUE_TEMPLATE/config.yml",
  ".github/PULL_REQUEST_TEMPLATE.md",
] as const;

const expectedHelp = `Usage: oss-evidence collect owner/repository --maintainer username

Options:
  --since <90d|ISO_TIMESTAMP>  Inclusive reporting-window start (default: 90d)
  --format <markdown|json>     Output format (default: markdown)
  --output <PATH>              Create a new output file instead of stdout
  --max-items <1..1000>        Maximum items per paginated resource (default: 200)
  --help                       Show command help
  --version                    Show the package version`;

test("documentation includes every required public community file", () => {
  for (const path of requiredFiles) {
    assert.equal(existsSync(resolve(projectRoot, path)), true, path);
  }
});

test("documentation README contains the exact current command help", () => {
  assert.match(
    read("README.md"),
    new RegExp(`\\n${escapeRegex(expectedHelp)}\\n`),
  );
});

test("documentation changelog starts with the package version", () => {
  const packageVersion = JSON.parse(read("package.json")).version as string;
  const firstRelease = read("CHANGELOG.md").match(/^## \[([^\]]+)]/m)?.[1];
  assert.equal(firstRelease, packageVersion);
});

test("documentation local Markdown links resolve to tracked paths", () => {
  for (const source of requiredFiles.filter((path) => path.endsWith(".md"))) {
    const markdown = read(source);
    for (const match of markdown.matchAll(/\[[^\]]*]\(([^)]+)\)/g)) {
      const rawTarget = match[1].trim().replace(/^<|>$/g, "");
      if (/^(?:https?:|mailto:|#)/i.test(rawTarget)) continue;
      const target = decodeURIComponent(rawTarget.split("#", 1)[0]);
      const absolute = resolve(projectRoot, dirname(source), target);
      assert.equal(existsSync(absolute), true, `${source} -> ${rawTarget}`);
      assert.equal(
        statSync(absolute).isFile(),
        true,
        `${source} -> ${rawTarget}`,
      );
    }
  }
});

test("documentation routes vulnerabilities privately and avoids eligibility claims", () => {
  const security = read("SECURITY.md");
  assert.match(
    security,
    /https:\/\/github\.com\/kilmidas\/oss-maintainer-evidence\/security\/advisories\/new/,
  );
  assert.doesNotMatch(security, /@[a-z0-9.-]+\.[a-z]{2,}/i);

  const publicDocs = [
    "README.md",
    "CONTRIBUTING.md",
    "SUPPORT.md",
    "docs/limitations.md",
  ]
    .map(read)
    .join("\n");
  assert.doesNotMatch(publicDocs, /guarantees? (?:grant|program) acceptance/i);
  assert.doesNotMatch(publicDocs, /supports? private repositories/i);
  assert.match(publicDocs, /does not (?:score|decide)[^\n]*eligibility/i);
});

test("documentation does not claim public forks are rejected", () => {
  const scopeDocs = ["README.md", "docs/architecture.md", "docs/limitations.md"]
    .map(read)
    .join("\n");
  assert.doesNotMatch(scopeDocs, /non-fork|fork[^\n]*(?:reject|fail closed)/i);
});

test("ecosystem importance narrative covers every ledger claim and source", () => {
  const narrative = read("docs/ecosystem-importance.md");
  const ledger = JSON.parse(read("docs/ecosystem-importance.sources.json")) as {
    claims: Array<{ id: string }>;
    sources: Array<{ id: string }>;
  };
  for (const { id } of [...ledger.claims, ...ledger.sources]) {
    assert.match(narrative, new RegExp(`\\b${escapeRegex(id)}\\b`), id);
  }
});

test("ecosystem importance narrative rejects adoption and endorsement claims", () => {
  const narrative = read("docs/ecosystem-importance.md");
  assert.match(narrative, /does not demonstrate external adoption/i);
  assert.match(narrative, /does not implement or certify the CHAOSS model/i);
  assert.match(narrative, /does not assess OpenSSF security posture/i);
  assert.doesNotMatch(narrative, /endorsed by|certified by|widely adopted/i);
  assert.doesNotMatch(
    narrative,
    /guarantees? (?:funding|eligibility|acceptance)/i,
  );
});

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
