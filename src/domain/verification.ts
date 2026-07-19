import { InputError } from "../errors.js";
import { reportSchema } from "./report.js";

const MAX_TARGETS = 2_000;
const compare = (left: string, right: string) =>
  left < right ? -1 : left > right ? 1 : 0;

export interface VerificationTarget {
  targetUrl: string;
  evidenceUrls: string[];
}

export interface VerificationPlan {
  evidenceUrls: string[];
  targets: VerificationTarget[];
}

function targetFor(evidenceUrl: string): string {
  const url = new URL(evidenceUrl);
  url.hash = "";
  return url.toString();
}

export function createVerificationPlan(value: unknown): VerificationPlan {
  const parsed = reportSchema.safeParse(value);
  if (!parsed.success) {
    throw new InputError("Report does not match schema version 1.0.");
  }

  const report = parsed.data;
  const evidenceUrls = new Set<string>([report.repository.sourceUrl]);

  for (const activities of Object.values(report.activities) as Array<
    Array<{ url: string }>
  >) {
    for (const activity of activities) evidenceUrls.add(activity.url);
  }
  for (const communityFile of Object.values(report.community)) {
    if (communityFile.sourceUrl) evidenceUrls.add(communityFile.sourceUrl);
  }

  const sortedEvidenceUrls = [...evidenceUrls].sort(compare);
  const grouped = new Map<string, string[]>();
  for (const evidenceUrl of sortedEvidenceUrls) {
    const targetUrl = targetFor(evidenceUrl);
    const group = grouped.get(targetUrl) ?? [];
    group.push(evidenceUrl);
    grouped.set(targetUrl, group);
  }

  if (grouped.size > MAX_TARGETS) {
    throw new InputError("Report exceeds the 2,000 HTTP target limit.");
  }

  return {
    evidenceUrls: sortedEvidenceUrls,
    targets: [...grouped.entries()]
      .sort(([left], [right]) => compare(left, right))
      .map(([targetUrl, urls]) => ({ targetUrl, evidenceUrls: urls })),
  };
}
