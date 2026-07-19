import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import { runVerification } from "../src/app/verify.js";
import type { VerificationPlan } from "../src/domain/verification.js";

test("verification app bounds concurrency at eight and requests each target once", async () => {
  const plan: VerificationPlan = {
    evidenceUrls: Array.from(
      { length: 20 },
      (_, index) => `https://github.com/acme/demo/issues/${index + 1}`,
    ),
    targets: Array.from({ length: 20 }, (_, index) => {
      const targetUrl = `https://github.com/acme/demo/issues/${index + 1}`;
      return { targetUrl, evidenceUrls: [targetUrl] };
    }),
  };
  let active = 0;
  let maximumActive = 0;
  const calls: string[] = [];

  const report = await runVerification(plan, async (targetUrl) => {
    calls.push(targetUrl);
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await delay(2);
    active -= 1;
    return { status: "pass", httpStatus: 200, finalUrl: targetUrl };
  });

  assert.equal(maximumActive, 8);
  assert.deepEqual(calls.slice().sort(), plan.evidenceUrls.slice().sort());
  assert.equal(new Set(calls).size, 20);
  assert.deepEqual(report.summary, {
    passed: 20,
    total: 20,
    uniqueTargets: 20,
  });
  assert.equal(report.status, "complete");
});

test("verification app propagates one grouped target result in stable URL order", async () => {
  const targetUrl = "https://github.com/acme/demo/pull/7";
  const evidenceUrls = [
    `${targetUrl}#pullrequestreview-1`,
    `${targetUrl}#pullrequestreview-2`,
  ];
  const plan: VerificationPlan = {
    evidenceUrls,
    targets: [{ targetUrl, evidenceUrls }],
  };
  let calls = 0;

  const report = await runVerification(plan, async () => {
    calls += 1;
    return { status: "fail", reason: "http_404", httpStatus: 404 };
  });

  assert.equal(calls, 1);
  assert.deepEqual(report, {
    status: "failed",
    results: evidenceUrls.map((url) => ({
      url,
      targetUrl,
      status: "fail",
      reason: "http_404",
      httpStatus: 404,
    })),
    summary: { passed: 0, total: 2, uniqueTargets: 1 },
  });
});

test("verification app replaces unsafe injected transport data", async () => {
  const targetUrl = "https://github.com/acme/demo";
  const report = await runVerification(
    {
      evidenceUrls: [targetUrl],
      targets: [{ targetUrl, evidenceUrls: [targetUrl] }],
    },
    async () => ({
      status: "fail",
      reason: "ghp_syntheticcredentialthatmustneverappear",
    }),
  );

  assert.deepEqual(report.results[0], {
    url: targetUrl,
    targetUrl,
    status: "fail",
    reason: "protocol",
  });
});
