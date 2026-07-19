import { aggregateEvidence } from "../domain/aggregate.js";
import type { CollectInput } from "../domain/input.js";
import type { Report } from "../domain/report.js";
import { OperationalError, RequiredCollectionError } from "../errors.js";
import type { IssueEvidence } from "../github/collect-issues.js";
import type { PullEvidence } from "../github/collect-pulls.js";
import type { ReleaseEvidence } from "../github/collect-repository.js";

interface PreflightResult {
  fullName: string;
  defaultBranch: string;
}

interface PaginationEvidence {
  fetched: number;
  truncated: boolean;
}

interface RepositoryResult {
  repository: Report["repository"];
  releases: ReleaseEvidence[];
  community: Report["community"];
  adoption: Report["adoption"];
  pagination: {
    releases: PaginationEvidence;
    contributors: PaginationEvidence;
  };
  limitations: Report["limitations"];
  partial: boolean;
}

interface PullResult {
  activities: {
    authoredPullRequests: PullEvidence[];
    mergedPullRequests: PullEvidence[];
    reviews: PullEvidence[];
  };
  pagination: {
    authoredPullRequests: PaginationEvidence;
    mergedPullRequests: PaginationEvidence;
    reviews: PaginationEvidence;
  };
  limitations: Report["limitations"];
  partial: boolean;
}

interface IssueResult {
  activities: {
    openedIssues: IssueEvidence[];
    closedIssues: IssueEvidence[];
    issueComments: IssueEvidence[];
  };
  pagination: {
    openedIssues: PaginationEvidence;
    closedIssues: PaginationEvidence;
    issueComments: PaginationEvidence;
  };
  limitations: Report["limitations"];
  partial: boolean;
}

export interface CollectionServices {
  preflight(owner: string, repo: string): Promise<PreflightResult>;
  collectRepository(
    input: CollectInput & { defaultBranch: string; observedAt: string },
  ): Promise<RepositoryResult>;
  collectPulls(input: CollectInput): Promise<PullResult>;
  collectIssues(input: CollectInput): Promise<IssueResult>;
}

const compareLimitations = (
  a: Report["limitations"][number],
  b: Report["limitations"][number],
) =>
  a.code.localeCompare(b.code, "en") ||
  a.resource.localeCompare(b.resource, "en") ||
  a.message.localeCompare(b.message, "en");

export async function collectEvidence(
  input: CollectInput,
  services: CollectionServices,
): Promise<Report> {
  try {
    const preflight = await services.preflight(
      input.repository.owner,
      input.repository.name,
    );
    const normalizedInput: CollectInput = {
      ...input,
      repository: {
        ...input.repository,
        fullName: preflight.fullName,
      },
    };
    const [repository, pulls, issues] = await Promise.all([
      services.collectRepository({
        ...normalizedInput,
        defaultBranch: preflight.defaultBranch,
        observedAt: input.until,
      }),
      services.collectPulls(normalizedInput),
      services.collectIssues(normalizedInput),
    ]);
    const partial = repository.partial || pulls.partial || issues.partial;
    return aggregateEvidence({
      generatedAt: input.until,
      status: partial ? "partial" : "complete",
      query: {
        repository: normalizedInput.repository,
        maintainer: normalizedInput.maintainer,
        since: normalizedInput.since,
        until: normalizedInput.until,
        maxItems: normalizedInput.maxItems,
      },
      repository: repository.repository,
      activities: {
        releases: repository.releases,
        authoredPullRequests: pulls.activities.authoredPullRequests,
        mergedPullRequests: pulls.activities.mergedPullRequests,
        reviews: pulls.activities.reviews,
        openedIssues: issues.activities.openedIssues,
        closedIssues: issues.activities.closedIssues,
        issueComments: issues.activities.issueComments,
      },
      community: repository.community,
      adoption: repository.adoption,
      pagination: {
        ...repository.pagination,
        ...pulls.pagination,
        ...issues.pagination,
      },
      limitations: [
        ...repository.limitations,
        ...pulls.limitations,
        ...issues.limitations,
      ].sort(compareLimitations),
    } as never);
  } catch (error) {
    if (error instanceof OperationalError) throw error;
    throw new RequiredCollectionError(
      "Required public GitHub evidence could not be collected.",
    );
  }
}
