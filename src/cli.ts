#!/usr/bin/env node

import { getVersion } from "./version.js";

const HELP_TEXT =
  "Usage: oss-evidence collect owner/repository --maintainer username\n\n" +
  "Options:\n" +
  "  --help     Show command help\n" +
  "  --version  Show the package version\n";

function reportPackageMetadataFailure(): void {
  process.stderr.write(
    "Unable to read package metadata. Reinstall oss-evidence.\n",
  );
  process.exitCode = 1;
}

async function runCollect(args: readonly string[]): Promise<void> {
  const { parseCollectInput } = await import("./domain/input.js");
  const {
    InputError,
    OperationalError,
    RequiredCollectionError,
    sanitizeErrorMessage,
  } = await import("./errors.js");

  try {
    parseCollectInput(args, new Date());
    throw new RequiredCollectionError(
      "Collection is not available in this build.",
    );
  } catch (error) {
    const operationalError =
      error instanceof OperationalError
        ? error
        : new InputError("Invalid command input.");
    process.stderr.write(`${sanitizeErrorMessage(operationalError.message)}\n`);
    process.exitCode = operationalError.exitCode;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--help") {
    process.stdout.write(HELP_TEXT);
  } else if (args.length === 1 && args[0] === "--version") {
    let version: string;
    try {
      version = getVersion();
    } catch {
      reportPackageMetadataFailure();
      return;
    }
    process.stdout.write(`${version}\n`);
  } else {
    await runCollect(args);
  }
}

await main();
