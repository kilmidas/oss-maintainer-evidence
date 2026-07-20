import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (path: string) => readFileSync(resolve(projectRoot, path), "utf8");
const reusableWorkflowSha = "3a9aba7273decb55c455a925a3c06370f6213967";

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
  "docs/independent-validation.md",
  "docs/limitations.md",
  ".github/ISSUE_TEMPLATE/bug.yml",
  ".github/ISSUE_TEMPLATE/feature.yml",
  ".github/ISSUE_TEMPLATE/validation.yml",
  ".github/ISSUE_TEMPLATE/config.yml",
  ".github/PULL_REQUEST_TEMPLATE.md",
] as const;

const expectedHelp = `Usage: oss-evidence collect owner/repository --maintainer username
       oss-evidence verify <report.json>

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

test("documentation describes the signed-out verifier boundary", () => {
  const packageMetadata = JSON.parse(read("package.json")) as {
    version: string;
    private: boolean;
  };
  const readme = read("README.md");
  assert.equal(packageMetadata.version, "0.3.0");
  assert.equal(packageMetadata.private, true);
  assert.match(readme, /oss-evidence verify <report\.json>/);
  assert.match(readme, /without (?:GitHub )?credentials/i);
  assert.match(readme, /\| `6` \|[^\n]+verification/i);
  assert.match(readme, /not published to the npm registry/i);
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

test("public documentation links the ecosystem evidence without overclaiming", () => {
  const readme = read("README.md");
  const limitations = read("docs/limitations.md");
  assert.match(
    readme,
    /\[Ecosystem importance evidence]\(docs\/ecosystem-importance\.md\)/,
  );
  assert.match(
    limitations,
    /\[ecosystem importance evidence]\(ecosystem-importance\.md\)/i,
  );
  assert.match(limitations, /does not demonstrate external adoption/i);
});

test("public documentation provides a safe independent validation path", () => {
  const readme = read("README.md");
  const contributing = read("CONTRIBUTING.md");
  const guide = read("docs/independent-validation.md");
  const issueForm = read(".github/ISSUE_TEMPLATE/validation.yml");

  assert.match(
    readme,
    /\[Independent validation]\(docs\/independent-validation\.md\)/,
  );
  assert.match(
    contributing,
    /\[independent validation guide]\(docs\/independent-validation\.md\)/i,
  );
  assert.match(guide, /oss-evidence verify evidence\.json/);
  assert.match(guide, /sharing (?:the )?report is optional/i);
  assert.match(guide, /does not demonstrate external adoption/i);
  assert.match(guide, /does not imply endorsement or affiliation/i);
  assert.match(issueForm, /label: Released version/);
  assert.match(issueForm, /label: Validation outcome/);
  assert.match(issueForm, /only public GitHub\.com data/i);
  assert.match(
    issueForm,
    /does not imply endorsement, certification, or affiliation/i,
  );
  assert.doesNotMatch(issueForm, /token value|private report contents/i);
});

test("public documentation provides immutable and convenient workflow callers", () => {
  const readme = read("README.md");
  const yamlBlocks = [...readme.matchAll(/```yaml\n([\s\S]*?)```/g)].map(
    (match) => match[1],
  );
  const immutable = yamlBlocks.find((block) =>
    block.includes(`collect-evidence.yml@${reusableWorkflowSha} # v0.3.0`),
  );
  const tagged = yamlBlocks.find((block) =>
    block.includes("collect-evidence.yml@v0.3.0"),
  );

  assert.ok(immutable, "immutable reusable workflow example");
  assert.match(immutable, /^permissions:\n {2}contents: read$/m);
  assert.match(immutable, /repository: owner\/repository/);
  assert.match(immutable, /maintainer: username/);
  assert.doesNotMatch(immutable, /secrets:/);
  assert.ok(tagged, "tagged reusable workflow example");
  assert.match(readme, /tag can be moved/i);
  assert.match(readme, /not the recommended security path/i);
  assert.match(readme, /caller repository[^\n]*runner usage/i);
});

test("public documentation provides convenience and verified release execution", () => {
  const readme = read("README.md");
  const convenience =
    "npm exec --yes --package=https://github.com/kilmidas/oss-maintainer-evidence/releases/download/v0.3.0/oss-evidence-0.3.0.tgz -- oss-evidence --version";
  const localArchive =
    'npm exec --yes --package="$PWD/oss-evidence-0.3.0.tgz" -- oss-evidence --version';

  assert.ok(readme.includes(convenience));
  assert.match(
    readme,
    /does not automatically verify[^\n]*(?:checksum|attestation)/i,
  );
  assert.match(
    readme,
    /gh release download v0\.3\.0 --repo kilmidas\/oss-maintainer-evidence/,
  );
  assert.match(readme, /shasum -a 256 -c oss-evidence-0\.3\.0\.tgz\.sha256/);
  assert.match(
    readme,
    /gh attestation verify oss-evidence-0\.3\.0\.tgz\s+\\?\s*--repo kilmidas\/oss-maintainer-evidence/,
  );
  assert.ok(readme.includes(localArchive));
  assert.match(readme, /expected output:\s*`0\.3\.0`/i);
});

test("validation and release docs preserve honest workflow interpretation", () => {
  const readme = read("README.md");
  const guide = read("docs/independent-validation.md");
  const checklist = read("docs/release-checklist.md");
  const changelog = read("CHANGELOG.md");

  assert.match(readme, /self-smoke[^\n]*not independent adoption/i);
  assert.match(guide, /reusable workflow/i);
  assert.match(guide, /pin[^\n]*40-character commit SHA/i);
  assert.match(guide, /only public GitHub\.com data/i);
  assert.match(guide, /oss-maintainer-evidence[^\n]*artifact/i);
  assert.match(checklist, /reusable workflow/i);
  assert.match(checklist, /Evidence Smoke/);
  assert.match(checklist, /gh attestation verify/);
  assert.match(changelog, /## \[0\.3\.0]/);
  assert.match(changelog, /immutable commit/i);
  assert.match(changelog, /self-smoke/i);
  assert.doesNotMatch(
    [readme, guide, checklist, changelog].join("\n"),
    /self-smoke[^\n]*(?:proves|demonstrates)[^\n]*(?:adoption|endorsement)/i,
  );
});

test("the standard check validates the committed ecosystem ledger", () => {
  const scripts = (
    JSON.parse(read("package.json")) as { scripts: Record<string, string> }
  ).scripts;
  assert.equal(
    scripts["evidence:check"],
    "node scripts/validate-ecosystem-evidence.mjs",
  );
  assert.match(scripts.check, /npm run evidence:check/);
});

test("latest public example records and links the v0.2.0 maintenance release", () => {
  const readme = read("README.md");
  const report = JSON.parse(
    read("examples/oss-maintainer-evidence-v0.2.0.json"),
  ) as {
    status: string;
    summary: { releases: number };
    adoption: {
      stars: number;
      forks: number;
      watchers: number;
      contributors: number;
      observedAt: string;
    };
    activities: { releases: Array<{ url: string }> };
  };

  assert.match(readme, /examples\/oss-maintainer-evidence-v0\.2\.0\.json/);
  assert.equal(report.status, "complete");
  assert.equal(report.summary.releases, 2);
  assert.equal(report.adoption.stars, 0);
  assert.equal(report.adoption.forks, 0);
  assert.equal(report.adoption.watchers, 0);
  assert.equal(report.adoption.contributors, 1);
  assert.match(report.adoption.observedAt, /Z$/);
  assert.ok(
    report.activities.releases.some(
      ({ url }) =>
        url ===
        "https://github.com/kilmidas/oss-maintainer-evidence/releases/tag/v0.2.0",
    ),
  );
});

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
