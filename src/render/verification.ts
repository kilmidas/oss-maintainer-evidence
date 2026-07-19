import type { VerificationReport } from "../app/verify.js";

export function renderVerification(report: VerificationReport): string {
  const lines = report.results.map((result) => {
    if (result.status === "fail") {
      return `FAIL ${result.reason} ${result.url}`;
    }
    const redirect =
      result.finalUrl === result.targetUrl ? "" : ` -> ${result.finalUrl}`;
    return `PASS ${result.httpStatus} ${result.url}${redirect}`;
  });
  lines.push(
    `Verified ${report.summary.passed} of ${report.summary.total} evidence links; ${report.summary.uniqueTargets} unique HTTP targets.`,
  );
  return `${lines.join("\n")}\n`;
}
