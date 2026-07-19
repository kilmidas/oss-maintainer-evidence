import assert from "node:assert/strict";
import test from "node:test";

import { renderVerification } from "../src/render/verification.js";

test("verification renderer emits deterministic pass, fail, and summary lines", () => {
  const rendered = renderVerification({
    status: "failed",
    results: [
      {
        url: "https://github.com/acme/demo",
        targetUrl: "https://github.com/acme/demo",
        status: "pass",
        httpStatus: 200,
        finalUrl: "https://github.com/acme/renamed",
      },
      {
        url: "https://github.com/acme/demo/issues/7",
        targetUrl: "https://github.com/acme/demo/issues/7",
        status: "fail",
        reason: "http_404",
        httpStatus: 404,
      },
    ],
    summary: { passed: 1, total: 2, uniqueTargets: 2 },
  });

  assert.equal(
    rendered,
    "PASS 200 https://github.com/acme/demo -> https://github.com/acme/renamed\n" +
      "FAIL http_404 https://github.com/acme/demo/issues/7\n" +
      "Verified 1 of 2 evidence links; 2 unique HTTP targets.\n",
  );
});

test("verification renderer omits an arrow without a redirect", () => {
  const url = "https://github.com/acme/demo";
  assert.equal(
    renderVerification({
      status: "complete",
      results: [
        {
          url,
          targetUrl: url,
          status: "pass",
          httpStatus: 204,
          finalUrl: url,
        },
      ],
      summary: { passed: 1, total: 1, uniqueTargets: 1 },
    }),
    `PASS 204 ${url}\nVerified 1 of 1 evidence links; 1 unique HTTP targets.\n`,
  );
});
