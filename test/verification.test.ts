import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { createVerificationPlan } from "../src/domain/verification.js";
import { InputError } from "../src/errors.js";

const loadReport = (): Record<string, unknown> =>
  JSON.parse(readFileSync(resolve("test/golden/report-complete.json"), "utf8"));

test("verification plan validates, sorts, deduplicates, and groups fragments", () => {
  const report = loadReport();
  report.activities = {
    ...(report.activities as Record<string, unknown>),
    reviews: [
      {
        id: "2",
        type: "review",
        actor: "Alice",
        occurredAt: "2024-06-02T00:00:00.000Z",
        url: "https://github.com/acme/demo/pull/7#pullrequestreview-2",
        title: "Second review",
        attributionRule: "review.user.login",
      },
      {
        id: "1",
        type: "review",
        actor: "Alice",
        occurredAt: "2024-06-01T00:00:00.000Z",
        url: "https://github.com/acme/demo/pull/7#pullrequestreview-1",
        title: "First review",
        attributionRule: "review.user.login",
      },
    ],
  };
  report.community = {
    readme: {
      status: "present",
      sourceUrl: "https://github.com/acme/demo",
    },
    support: {
      status: "unavailable",
      sourceUrl: "https://github.com/acme/demo/blob/main/SUPPORT.md",
    },
  };

  const plan = createVerificationPlan(report);

  assert.deepEqual(plan.evidenceUrls, [
    "https://github.com/acme/demo",
    "https://github.com/acme/demo/blob/main/SUPPORT.md",
    "https://github.com/acme/demo/pull/7#pullrequestreview-1",
    "https://github.com/acme/demo/pull/7#pullrequestreview-2",
  ]);
  assert.deepEqual(plan.targets, [
    {
      targetUrl: "https://github.com/acme/demo",
      evidenceUrls: ["https://github.com/acme/demo"],
    },
    {
      targetUrl: "https://github.com/acme/demo/blob/main/SUPPORT.md",
      evidenceUrls: ["https://github.com/acme/demo/blob/main/SUPPORT.md"],
    },
    {
      targetUrl: "https://github.com/acme/demo/pull/7",
      evidenceUrls: [
        "https://github.com/acme/demo/pull/7#pullrequestreview-1",
        "https://github.com/acme/demo/pull/7#pullrequestreview-2",
      ],
    },
  ]);
});

test("verification plan rejects reports outside the strict schema", () => {
  const report = loadReport();
  (report.repository as Record<string, unknown>).sourceUrl =
    "https://example.test/acme/demo";

  assert.throws(() => createVerificationPlan(report), InputError);
});

test("verification plan rejects more than 2,000 unique HTTP targets", () => {
  const report = loadReport();
  report.community = Object.fromEntries(
    Array.from({ length: 2_000 }, (_, index) => [
      `file-${index}`,
      {
        status: "present",
        sourceUrl: `https://github.com/acme/demo/issues/${index + 1}`,
      },
    ]),
  );

  assert.throws(
    () => createVerificationPlan(report),
    (error: unknown) =>
      error instanceof InputError && /2,000/.test(error.message),
  );
});
