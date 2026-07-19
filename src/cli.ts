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

function reportPackageMetadataFailure(): void {
  process.stderr.write(
    "Unable to read package metadata. Reinstall oss-evidence.\n",
  );
  process.exitCode = 1;
}

function main(): void {
  const args = process.argv.slice(2);
  let parsedArguments: ReturnType<typeof parseArgs>;

  try {
    parsedArguments = parseArgs({
      args,
      options: {
        help: { type: "boolean" },
        version: { type: "boolean" },
      },
      allowPositionals: true,
      strict: true,
    });
  } catch {
    reportUnsupportedInvocation();
    return;
  }

  const { values, positionals } = parsedArguments;

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
    let version: string;
    try {
      version = getVersion();
    } catch {
      reportPackageMetadataFailure();
      return;
    }
    process.stdout.write(`${version}\n`);
  } else {
    reportUnsupportedInvocation();
  }
}

main();
