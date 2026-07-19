import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { parseCollectInput } from "../src/domain/input.js";
import { InputError } from "../src/errors.js";

const NOW = new Date("2026-07-19T12:34:56.789Z");
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cliPath = resolve(projectRoot, "dist/cli.js");

function runCli(args: readonly string[]) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: projectRoot,
    encoding: "utf8",
  });
}

test("input preserves valid repository and maintainer casing", () => {
  const input = parseCollectInput(
    [
      "collect",
      "OpenAI/Codex_CLI.js",
      "--maintainer",
      "Case-Preserved",
      "--since",
      "2026-07-18T21:15:30+09:00",
      "--format",
      "json",
      "--output",
      "reports/evidence.json",
      "--max-items",
      "1000",
    ],
    NOW,
  );

  assert.deepEqual(input, {
    repository: {
      owner: "OpenAI",
      name: "Codex_CLI.js",
      fullName: "OpenAI/Codex_CLI.js",
    },
    maintainer: "Case-Preserved",
    since: "2026-07-18T12:15:30.000Z",
    until: "2026-07-19T12:34:56.789Z",
    format: "json",
    output: "reports/evidence.json",
    maxItems: 1000,
  });
});

test("input rejects URLs, hosts, extra paths, dashes, whitespace, and controls", () => {
  const invalidRepositories = [
    "https://github.com/OpenAI/Codex",
    "https://git.example.test/OpenAI/Codex",
    "github.example.test/OpenAI/Codex",
    "OpenAI/Codex/extra",
    "-OpenAI/Codex",
    "OpenAI/-Codex",
    "Open AI/Codex",
    "OpenAI/Codex CLI",
    "OpenAI/Codex\nCLI",
    "OpenAI/.",
    "OpenAI/..",
  ];

  for (const repository of invalidRepositories) {
    assert.throws(
      () =>
        parseCollectInput(
          ["collect", repository, "--maintainer", "octocat"],
          NOW,
        ),
      /.+/,
      repository,
    );
  }
});

test("input enforces conservative account identifiers", () => {
  const invalidMaintainers = [
    "-octocat",
    "octocat-",
    "octo--cat",
    "octo_cat",
    "octo.cat",
    "octo cat",
    "octo\tcat",
    "a".repeat(40),
    "",
  ];

  for (const maintainer of invalidMaintainers) {
    assert.throws(
      () =>
        parseCollectInput(
          ["collect", "OpenAI/Codex", "--maintainer", maintainer],
          NOW,
        ),
      /.+/,
      JSON.stringify(maintainer),
    );
  }
});

test("input converts relative days and uses the injected clock as inclusive until", () => {
  const input = parseCollectInput(
    ["collect", "OpenAI/Codex", "--maintainer", "octocat", "--since", "90d"],
    NOW,
  );

  assert.equal(input.since, "2026-04-20T12:34:56.789Z");
  assert.equal(input.until, "2026-07-19T12:34:56.789Z");
});

test("input accepts timezone-bearing timestamps and normalizes them to UTC", () => {
  const input = parseCollectInput(
    [
      "collect",
      "OpenAI/Codex",
      "--maintainer",
      "octocat",
      "--since",
      "2026-07-19T12:34:56.789+00:00",
    ],
    NOW,
  );

  assert.equal(input.since, "2026-07-19T12:34:56.789Z");
});

test("input normalizes leap seconds with offsets and fractional milliseconds", () => {
  const cases = [
    {
      since: "2016-12-31T23:59:60Z",
      expected: "2017-01-01T00:00:00.000Z",
    },
    {
      since: "2017-01-01T08:59:60.5+09:00",
      expected: "2017-01-01T00:00:00.500Z",
    },
  ];

  for (const { since, expected } of cases) {
    const input = parseCollectInput(
      ["collect", "OpenAI/Codex", "--maintainer", "octocat", "--since", since],
      NOW,
    );

    assert.equal(input.since, expected, since);
  }
});

test("input rejects malformed, invalid-date, and future leap seconds", () => {
  for (const since of [
    "2016-12-31T23:59:61Z",
    "2016-02-30T23:59:60Z",
    "2016-12-31T12:34:60Z",
    "2016-12-30T23:59:60Z",
    "2016-12-31T23:59:60.0000Z",
  ]) {
    assert.throws(
      () =>
        parseCollectInput(
          [
            "collect",
            "OpenAI/Codex",
            "--maintainer",
            "octocat",
            "--since",
            since,
          ],
          NOW,
        ),
      InputError,
      since,
    );
  }

  assert.throws(
    () =>
      parseCollectInput(
        [
          "collect",
          "OpenAI/Codex",
          "--maintainer",
          "octocat",
          "--since",
          "2016-12-31T23:59:60.001Z",
        ],
        new Date("2017-01-01T00:00:00.000Z"),
      ),
    InputError,
  );
});

test("input rejects timestamps with submillisecond precision", () => {
  for (const since of [
    "2026-07-19T12:34:56.7890Z",
    "2026-07-19T12:34:56.7891Z",
  ]) {
    assert.throws(() =>
      parseCollectInput(
        [
          "collect",
          "OpenAI/Codex",
          "--maintainer",
          "octocat",
          "--since",
          since,
        ],
        NOW,
      ),
    );
  }
});

test("input rejects invalid and future reporting-window starts", () => {
  const invalidSinceValues = [
    "0d",
    "-1d",
    "1.5d",
    "01d",
    "9007199254740992d",
    "2026-07-19T12:34:56",
    "2026-02-30T00:00:00Z",
    "2026-07-19T12:34:56.790Z",
    "tomorrow",
  ];

  for (const since of invalidSinceValues) {
    assert.throws(
      () =>
        parseCollectInput(
          [
            "collect",
            "OpenAI/Codex",
            "--maintainer",
            "octocat",
            "--since",
            since,
          ],
          NOW,
        ),
      /.+/,
      since,
    );
  }
});

test("input applies bounded defaults", () => {
  const input = parseCollectInput(
    ["collect", "OpenAI/Codex", "--maintainer", "octocat"],
    NOW,
  );

  assert.deepEqual(input, {
    repository: {
      owner: "OpenAI",
      name: "Codex",
      fullName: "OpenAI/Codex",
    },
    maintainer: "octocat",
    since: "2026-04-20T12:34:56.789Z",
    until: "2026-07-19T12:34:56.789Z",
    format: "markdown",
    maxItems: 200,
  });
});

test("input accepts max-items integers from 1 through 1000", () => {
  for (const maxItems of ["1", "200", "1000"]) {
    const input = parseCollectInput(
      [
        "collect",
        "OpenAI/Codex",
        "--maintainer",
        "octocat",
        "--max-items",
        maxItems,
      ],
      NOW,
    );

    assert.equal(input.maxItems, Number(maxItems));
  }
});

test("input rejects out-of-range and malformed max-items", () => {
  for (const maxItems of ["0", "-1", "1.5", "1001", "01", "1e2", "NaN", ""]) {
    assert.throws(
      () =>
        parseCollectInput(
          [
            "collect",
            "OpenAI/Codex",
            "--maintainer",
            "octocat",
            "--max-items",
            maxItems,
          ],
          NOW,
        ),
      /.+/,
      JSON.stringify(maxItems),
    );
  }
});

test("input accepts exactly the documented formats", () => {
  for (const format of ["markdown", "json"] as const) {
    const input = parseCollectInput(
      [
        "collect",
        "OpenAI/Codex",
        "--maintainer",
        "octocat",
        "--format",
        format,
      ],
      NOW,
    );

    assert.equal(input.format, format);
  }

  for (const format of ["Markdown", "JSON", "text", ""]) {
    assert.throws(() =>
      parseCollectInput(
        [
          "collect",
          "OpenAI/Codex",
          "--maintainer",
          "octocat",
          "--format",
          format,
        ],
        NOW,
      ),
    );
  }
});

test("input requires the command, repository, and maintainer", () => {
  const incompleteArguments = [
    [],
    ["collect"],
    ["other", "OpenAI/Codex", "--maintainer", "octocat"],
    ["collect", "OpenAI/Codex"],
    ["collect", "OpenAI/Codex", "--maintainer"],
  ];

  for (const argv of incompleteArguments) {
    assert.throws(
      () => parseCollectInput(argv, NOW),
      /.+/,
      JSON.stringify(argv),
    );
  }
});

test("input failures use the stable input error category", () => {
  assert.throws(
    () =>
      parseCollectInput(["collect", "https://github.com/OpenAI/Codex"], NOW),
    InputError,
  );
});

test("input rejects duplicate and unknown flags", () => {
  const invalidArguments = [
    [
      "collect",
      "OpenAI/Codex",
      "--maintainer",
      "octocat",
      "--maintainer",
      "other",
    ],
    [
      "collect",
      "OpenAI/Codex",
      "--maintainer",
      "octocat",
      "--format",
      "json",
      "--format",
      "markdown",
    ],
    ["collect", "OpenAI/Codex", "--maintainer", "octocat", "--unknown", "x"],
    ["collect", "OpenAI/Codex", "--maintainer", "octocat", "extra"],
  ];

  for (const argv of invalidArguments) {
    assert.throws(
      () => parseCollectInput(argv, NOW),
      /.+/,
      JSON.stringify(argv),
    );
  }
});

test("input accepts safe output paths and rejects empty or control-bearing paths", () => {
  const valid = parseCollectInput(
    [
      "collect",
      "OpenAI/Codex",
      "--maintainer",
      "octocat",
      "--output",
      "reports/evidence report.md",
    ],
    NOW,
  );
  assert.equal(valid.output, "reports/evidence report.md");

  for (const output of ["", "report\0.md", "report\n.md", "report\u007f.md"]) {
    assert.throws(
      () =>
        parseCollectInput(
          [
            "collect",
            "OpenAI/Codex",
            "--maintainer",
            "octocat",
            "--output",
            output,
          ],
          NOW,
        ),
      /.+/,
      JSON.stringify(output),
    );
  }
});

test("CLI returns the typed required-collection failure after valid parsing", () => {
  const result = runCli([
    "collect",
    "OpenAI/Codex",
    "--maintainer",
    "octocat",
    "--since",
    "90d",
    "--format",
    "json",
    "--output",
    "reports/evidence.json",
    "--max-items",
    "1000",
  ]);

  assert.equal(result.status, 3);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "Collection is not available in this build.\n");
});

test("CLI reports invalid input as one sanitized line with exit 2", () => {
  const credential = "ghp_abcdefghijklmnopqrstuvwxyz1234567890";
  const result = runCli([
    "collect",
    `${credential}/repository/extra`,
    "--maintainer",
    "octocat",
  ]);

  assert.equal(result.status, 2);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr.includes(credential), false);
  assert.equal(result.stderr.trim().length > 0, true);
  assert.equal(result.stderr.split("\n").length, 2);
});

test("CLI reports collection module startup failures without raw details", () => {
  const installedRoot = mkdtempSync(
    join(tmpdir(), "oss-evidence-collect-startup-"),
  );
  const installedDist = resolve(installedRoot, "dist");

  try {
    mkdirSync(installedDist);
    for (const file of ["cli.js", "version.js", "package.json"]) {
      copyFileSync(
        resolve(projectRoot, "dist", file),
        resolve(installedDist, file),
      );
    }

    const result = spawnSync(
      process.execPath,
      [
        resolve(installedDist, "cli.js"),
        "collect",
        "OpenAI/Codex",
        "--maintainer",
        "octocat",
      ],
      { cwd: installedRoot, encoding: "utf8" },
    );

    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.equal(
      result.stderr,
      "Unable to start collection. Reinstall oss-evidence.\n",
    );
    assert.equal(result.stderr.includes(installedRoot), false);
    assert.doesNotMatch(
      result.stderr,
      /ERR_MODULE_NOT_FOUND|Cannot find module|domain\/input|errors\.js|at async/,
    );
  } finally {
    rmSync(installedRoot, { recursive: true, force: true });
  }
});

const malformedCollectionModules = [
  {
    label: "missing parser export",
    writeModules(installedDist: string) {
      writeFileSync(
        resolve(installedDist, "domain/input.js"),
        "export const unavailable = true;\n",
      );
      copyFileSync(
        resolve(projectRoot, "dist/errors.js"),
        resolve(installedDist, "errors.js"),
      );
    },
  },
  {
    label: "missing error exports",
    writeModules(installedDist: string) {
      copyFileSync(
        resolve(projectRoot, "dist/domain/input.js"),
        resolve(installedDist, "domain/input.js"),
      );
      writeFileSync(
        resolve(installedDist, "errors.js"),
        "export class InputError extends Error {}\n",
      );
    },
  },
] as const;

for (const { label, writeModules } of malformedCollectionModules) {
  test(`CLI reports ${label} as a safe startup failure`, () => {
    const installedRoot = mkdtempSync(
      join(tmpdir(), "oss-evidence-collect-malformed-"),
    );
    const installedDist = resolve(installedRoot, "dist");

    try {
      mkdirSync(resolve(installedDist, "domain"), { recursive: true });
      for (const file of ["cli.js", "version.js", "package.json"]) {
        copyFileSync(
          resolve(projectRoot, "dist", file),
          resolve(installedDist, file),
        );
      }
      writeModules(installedDist);

      const result = spawnSync(
        process.execPath,
        [
          resolve(installedDist, "cli.js"),
          "collect",
          "OpenAI/Codex",
          "--maintainer",
          "octocat",
        ],
        { cwd: installedRoot, encoding: "utf8" },
      );

      assert.equal(result.status, 1, label);
      assert.equal(result.stdout, "", label);
      assert.equal(
        result.stderr,
        "Unable to start collection. Reinstall oss-evidence.\n",
        label,
      );
      assert.equal(result.stderr.includes(installedRoot), false, label);
      assert.doesNotMatch(
        result.stderr,
        /TypeError|ERR_MODULE|Cannot find module|file:\/\/|at async/,
        label,
      );
    } finally {
      rmSync(installedRoot, { recursive: true, force: true });
    }
  });
}
