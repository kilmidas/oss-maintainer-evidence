import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const realProjectRoot = realpathSync(projectRoot);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const nonEmpty = z.string().trim().min(1);
const reviewedUrls = new Set([
  "https://www.linuxfoundation.org/research/open-source-maintainers",
  "https://www.chaoss.community/starter-project-health-metrics-model/",
  "https://openssf.org/scorecard/",
  "https://arxiv.org/abs/2411.06027",
  "https://docs.github.com/en/rest/repos/repos#get-a-repository",
  "https://docs.github.com/en/rest/repos/repos#list-repository-contributors",
  "https://docs.github.com/en/rest/releases/releases#list-releases",
  "https://docs.github.com/en/rest/search/search#search-issues-and-pull-requests",
  "https://docs.github.com/en/rest/pulls/pulls#get-a-pull-request",
  "https://docs.github.com/en/rest/pulls/reviews#list-reviews-for-a-pull-request",
  "https://docs.github.com/en/rest/issues/issues#get-an-issue",
  "https://docs.github.com/en/rest/issues/comments#list-issue-comments-for-a-repository",
  "https://docs.github.com/en/rest/repos/contents#get-repository-content",
]);

const source = z
  .object({
    id: nonEmpty,
    title: nonEmpty,
    publisher: nonEmpty,
    url: z
      .string()
      .url()
      .refine((value) => reviewedUrls.has(value), {
        message: "source URL is not in the reviewed source URL set",
      }),
    publishedAt: date.optional(),
    accessedAt: date,
    sourceType: z.enum([
      "official-documentation",
      "official-research",
      "research-paper",
    ]),
    reviewStatus: z.enum([
      "peer-reviewed",
      "not-peer-reviewed",
      "not-applicable",
      "unknown",
    ]),
  })
  .strict();

const claim = z
  .object({
    id: nonEmpty,
    statement: nonEmpty,
    sourceIds: z.array(nonEmpty).min(1),
    theme: z.enum([
      "maintainer-role",
      "measurement",
      "automation",
      "funding-impact",
    ]),
    projectRelevance: nonEmpty,
    limitations: z.array(nonEmpty).min(1),
  })
  .strict();

const mapping = z
  .object({
    evidenceType: z.enum([
      "release",
      "authored_pull_request",
      "merged_pull_request",
      "review",
      "opened_issue",
      "closed_issue",
      "issue_comment",
      "repository",
      "community",
      "adoption",
      "evidence_urls",
    ]),
    claimIds: z.array(nonEmpty).min(1),
    coverage: z.enum(["direct", "partial", "context-only"]),
    implementationEvidence: z.array(nonEmpty).min(1),
    notes: nonEmpty,
  })
  .strict();

const ledgerSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    asOf: date,
    sources: z.array(source).min(1),
    claims: z.array(claim).min(1),
    capabilityMappings: z.array(mapping).min(1),
  })
  .strict();

const duplicate = (values) => {
  const seen = new Set();
  return values.find((value) => seen.has(value) || !seen.add(value));
};

export function validateLedger(value) {
  const ledger = ledgerSchema.parse(value);
  const duplicateSource = duplicate(ledger.sources.map(({ id }) => id));
  if (duplicateSource)
    throw new Error(`duplicate source id: ${duplicateSource}`);
  const duplicateClaim = duplicate(ledger.claims.map(({ id }) => id));
  if (duplicateClaim) throw new Error(`duplicate claim id: ${duplicateClaim}`);

  const sourceIds = new Set(ledger.sources.map(({ id }) => id));
  const claimIds = new Set(ledger.claims.map(({ id }) => id));
  for (const entry of ledger.claims) {
    for (const id of entry.sourceIds) {
      if (!sourceIds.has(id)) throw new Error(`unknown source id: ${id}`);
    }
  }

  for (const entry of ledger.capabilityMappings) {
    for (const id of entry.claimIds) {
      if (!claimIds.has(id)) throw new Error(`unknown claim id: ${id}`);
    }
    for (const evidence of entry.implementationEvidence) {
      if (isAbsolute(evidence)) {
        throw new Error(`invalid implementation evidence: ${evidence}`);
      }
      const absolute = resolve(projectRoot, evidence);
      const fromRoot = relative(projectRoot, absolute);
      const lexicallyEscapesRoot =
        fromRoot === ".." ||
        fromRoot.startsWith(`..${sep}`) ||
        isAbsolute(fromRoot);
      if (
        lexicallyEscapesRoot ||
        fromRoot.length === 0 ||
        !existsSync(absolute)
      ) {
        throw new Error(`invalid implementation evidence: ${evidence}`);
      }

      const metadata = lstatSync(absolute);
      const real = realpathSync(absolute);
      const realFromRoot = relative(realProjectRoot, real);
      const reallyEscapesRoot =
        realFromRoot === ".." ||
        realFromRoot.startsWith(`..${sep}`) ||
        isAbsolute(realFromRoot);
      if (
        metadata.isSymbolicLink() ||
        !metadata.isFile() ||
        reallyEscapesRoot
      ) {
        throw new Error(`invalid implementation evidence: ${evidence}`);
      }
    }
  }
  return ledger;
}

function main() {
  const args = process.argv.slice(2);
  const file =
    args.length === 0
      ? resolve(projectRoot, "docs/ecosystem-importance.sources.json")
      : args.length === 2 && args[0] === "--file"
        ? resolve(args[1])
        : null;
  if (!file) {
    throw new Error("usage: validate-ecosystem-evidence.mjs [--file PATH]");
  }
  const ledger = validateLedger(JSON.parse(readFileSync(file, "utf8")));
  process.stdout.write(
    `${ledger.sources.length} source, ${ledger.claims.length} claim, ` +
      `${ledger.capabilityMappings.length} capability mapping\n`,
  );
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : "unknown error";
  process.stderr.write(`Ecosystem evidence validation failed: ${message}\n`);
  process.exitCode = 1;
}
