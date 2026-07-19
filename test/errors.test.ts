import assert from "node:assert/strict";
import test from "node:test";

import {
  InputError,
  type OperationalError,
  OutOfScopeError,
  OutputWriteError,
  PartialCollectionError,
  RequiredCollectionError,
  sanitizeErrorMessage,
  VerificationFailedError,
} from "../src/errors.js";

test("error categories expose stable exit codes", () => {
  const cases: Array<{
    error: OperationalError;
    exitCode: number;
    name: string;
  }> = [
    {
      error: new InputError("Invalid input."),
      exitCode: 2,
      name: "InputError",
    },
    {
      error: new OutOfScopeError("Repository is outside the supported scope."),
      exitCode: 2,
      name: "OutOfScopeError",
    },
    {
      error: new RequiredCollectionError("Required collection failed."),
      exitCode: 3,
      name: "RequiredCollectionError",
    },
    {
      error: new OutputWriteError("Output could not be written."),
      exitCode: 5,
      name: "OutputWriteError",
    },
    {
      error: new VerificationFailedError("Verification failed.", {}),
      exitCode: 6,
      name: "VerificationFailedError",
    },
  ];

  for (const { error, exitCode, name } of cases) {
    assert.equal(error.exitCode, exitCode);
    assert.equal(error.name, name);
    assert.equal(error instanceof Error, true);
  }
});

test("partial collection errors use exit 4 and carry the report value", () => {
  const report = { status: "partial", repository: "OpenAI/Codex" } as const;
  const error = new PartialCollectionError(
    "Optional collection failed.",
    report,
  );

  assert.equal(error.exitCode, 4);
  assert.equal(error.name, "PartialCollectionError");
  assert.equal(error.report, report);
});

test("error sanitizer redacts repeated multiline credentials", () => {
  const credentials = [
    "ghp_abcdefghijklmnopqrstuvwxyz1234567890",
    "gho_abcdefghijklmnopqrstuvwxyz1234567890",
    "ghu_abcdefghijklmnopqrstuvwxyz1234567890",
    "ghs_abcdefghijklmnopqrstuvwxyz1234567890",
    "ghr_abcdefghijklmnopqrstuvwxyz1234567890",
    "github_pat_11AAabcdefghijklmnopqrstuvwxyz1234567890",
    "sk-abcdefghijklmnopqrstuvwxyz1234567890ABCDE",
    "sk-proj-abcdefghijklmnopqrstuvwxyz1234567890ABCDE",
  ];
  const message = [
    "Public repository OpenAI/Codex failed.",
    `Authorization: Bearer ${credentials[0]}`,
    `authorization: token ${credentials[1]}`,
    `Retrying Bearer ${credentials[2]}.`,
    credentials.slice(3).join(" "),
    `Again: ${credentials[0]} and ${credentials[7]}`,
  ].join("\n");

  const sanitized = sanitizeErrorMessage(message);

  assert.match(sanitized, /Public repository OpenAI\/Codex failed\./);
  assert.match(sanitized, /Authorization: \[REDACTED\]/);
  assert.match(sanitized, /authorization: \[REDACTED\]/);
  assert.match(sanitized, /Bearer \[REDACTED\]/);
  for (const credential of credentials) {
    assert.equal(sanitized.includes(credential), false, credential);
  }
  assert.ok((sanitized.match(/\[REDACTED\]/g)?.length ?? 0) >= 8);
});

test("error sanitizer preserves ordinary public text", () => {
  const message =
    "GET https://api.github.com/repos/OpenAI/Codex returned 404. Try another public repository.";

  assert.equal(sanitizeErrorMessage(message), message);
});

test("error sanitizer redacts folded authorization and bearer credentials", () => {
  const cases = [
    {
      message: "Authorization:\n  opaque-secret-value",
      exposedParts: ["opaque", "secret", "value"],
    },
    {
      message: "Authorization: Bearer\r\n token-fragment",
      exposedParts: ["Bearer", "token-fragment"],
    },
    {
      message: "Bearer\n opaque-folded-value",
      exposedParts: ["opaque-folded-value"],
    },
  ];

  for (const { message, exposedParts } of cases) {
    const sanitized = sanitizeErrorMessage(message);

    assert.match(sanitized, /\[REDACTED\]/);
    for (const exposedPart of exposedParts) {
      assert.equal(sanitized.includes(exposedPart), false, message);
    }
  }
});

test("error sanitizer handles repeated ordinary and folded credentials", () => {
  const credentials = [
    "ordinary-secret-one",
    "ordinary-secret-two",
    "folded-secret-three",
    "folded-secret-four",
  ];
  const message = [
    "Public repository message before credentials.",
    `Authorization: ${credentials[0]}`,
    `Bearer ${credentials[1]}`,
    `Authorization:\n ${credentials[2]}`,
    `Bearer\r\n ${credentials[3]}`,
    "Public corrective action after credentials.",
  ].join("\n");

  const sanitized = sanitizeErrorMessage(message);

  assert.match(sanitized, /Public repository message before credentials\./);
  assert.match(sanitized, /Public corrective action after credentials\./);
  for (const credential of credentials) {
    assert.equal(sanitized.includes(credential), false, credential);
  }
  assert.equal(sanitized.match(/\[REDACTED\]/g)?.length, 4);
});

test("error sanitizer removes every folded bearer segment and preserves the next line", () => {
  const cases = [
    "Bearer opaque-part-one\r\n opaque-part-two\nPublic tail.",
    "Bearer opaque-before-space \r\n opaque-after-space\nPublic tail.",
    "Bearer \r\n opaque-after-spaced-fold\r\nPublic tail.",
  ];

  for (const message of cases) {
    const sanitized = sanitizeErrorMessage(message);

    assert.equal(sanitized.includes("opaque"), false, message);
    assert.equal(sanitized.includes("part-one"), false, message);
    assert.equal(sanitized.includes("part-two"), false, message);
    assert.match(sanitized, /^Bearer \[REDACTED\]/);
    assert.match(sanitized, /Public tail\.$/);
  }
});

test("operational errors expose one concise sanitized line", () => {
  const credential = "github_pat_11AAabcdefghijklmnopqrstuvwxyz1234567890";
  const error = new InputError(
    `Invalid input with ${credential}.\nAuthorization: Bearer ${credential}`,
  );

  assert.equal(error.message.includes(credential), false);
  assert.equal(error.message.includes("\n"), false);
  assert.match(error.message, /\[REDACTED\]/);
});
