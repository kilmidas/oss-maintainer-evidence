import { publicGithubUrlSchema } from "../domain/report.js";
import type { VerificationPlan } from "../domain/verification.js";
import {
  type TargetVerificationResult,
  verifySignedOutGithubTarget,
} from "../http/signed-out-github.js";

const CONCURRENCY = 8;
const SAFE_FAILURE =
  /^(?:http_[1-5]\d{2}|redirect_(?:missing|invalid|loop|limit)|timeout|network|invalid_target|protocol)$/;

export type VerifyTarget = (
  targetUrl: string,
) => Promise<TargetVerificationResult>;

export type EvidenceVerificationResult =
  | {
      url: string;
      targetUrl: string;
      status: "pass";
      httpStatus: number;
      finalUrl: string;
    }
  | {
      url: string;
      targetUrl: string;
      status: "fail";
      reason: string;
      httpStatus?: number;
    };

export interface VerificationReport {
  status: "complete" | "failed";
  results: EvidenceVerificationResult[];
  summary: {
    passed: number;
    total: number;
    uniqueTargets: number;
  };
}

function protocolFailure(): TargetVerificationResult {
  return { status: "fail", reason: "protocol" };
}

function normalizeResult(
  result: TargetVerificationResult,
): TargetVerificationResult {
  if (result.status === "pass") {
    return Number.isInteger(result.httpStatus) &&
      result.httpStatus >= 200 &&
      result.httpStatus <= 299 &&
      publicGithubUrlSchema.safeParse(result.finalUrl).success
      ? result
      : protocolFailure();
  }

  if (!SAFE_FAILURE.test(result.reason)) return protocolFailure();
  if (result.reason.startsWith("http_")) {
    const expectedStatus = Number(result.reason.slice(5));
    if (result.httpStatus !== expectedStatus) return protocolFailure();
  } else if (result.httpStatus !== undefined) return protocolFailure();
  return result;
}

export async function runVerification(
  plan: VerificationPlan,
  verifyTarget: VerifyTarget = verifySignedOutGithubTarget,
): Promise<VerificationReport> {
  const targetResults = new Array<TargetVerificationResult>(
    plan.targets.length,
  );
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      const target = plan.targets[index];
      if (target === undefined) return;
      try {
        targetResults[index] = normalizeResult(
          await verifyTarget(target.targetUrl),
        );
      } catch {
        targetResults[index] = protocolFailure();
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, plan.targets.length) }, worker),
  );

  const results: EvidenceVerificationResult[] = [];
  for (let index = 0; index < plan.targets.length; index += 1) {
    const target = plan.targets[index];
    const result = targetResults[index] ?? protocolFailure();
    if (target === undefined) continue;
    for (const url of target.evidenceUrls) {
      results.push({ url, targetUrl: target.targetUrl, ...result });
    }
  }
  results.sort((left, right) =>
    left.url < right.url ? -1 : left.url > right.url ? 1 : 0,
  );

  const passed = results.filter((result) => result.status === "pass").length;
  return {
    status: passed === results.length ? "complete" : "failed",
    results,
    summary: {
      passed,
      total: results.length,
      uniqueTargets: plan.targets.length,
    },
  };
}
