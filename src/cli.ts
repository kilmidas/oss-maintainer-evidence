#!/usr/bin/env node

import { parseArgs } from "node:util";

import { getVersion } from "./version.js";

const HELP_TEXT =
  "Usage: oss-evidence collect owner/repository --maintainer username\n\n" +
  "Options:\n" +
  "  --help     Show command help\n" +
  "  --version  Show the package version\n";

function reportUnsupportedInvocation(): void {
  process.stderr.write(
    "Unsupported invocation. Run oss-evidence --help for usage.\n",
  );
  process.exitCode = 2;
}

try {
  const args = process.argv.slice(2);
  const { values, positionals } = parseArgs({
    args,
    options: {
      help: { type: "boolean" },
      version: { type: "boolean" },
    },
    allowPositionals: true,
    strict: true,
  });

  const hasNoPositionals = positionals.length === 0;
  const hasOneArgument = args.length === 1;

  if (
    values.help === true &&
    values.version === undefined &&
    hasNoPositionals &&
    hasOneArgument
  ) {
    process.stdout.write(HELP_TEXT);
  } else if (
    values.version === true &&
    values.help === undefined &&
    hasNoPositionals &&
    hasOneArgument
  ) {
    process.stdout.write(`${getVersion()}\n`);
  } else {
    reportUnsupportedInvocation();
  }
} catch {
  reportUnsupportedInvocation();
}
