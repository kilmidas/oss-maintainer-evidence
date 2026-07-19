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

function reportCollectionStartupFailure(): void {
  process.stderr.write("Unable to start collection. Reinstall oss-evidence.\n");
  process.exitCode = 1;
}

function isErrorConstructor(value: unknown): boolean {
  return typeof value === "function" && value.prototype instanceof Error;
}

function hasExitCode(value: unknown, expected: number): boolean {
  if (!isErrorConstructor(value)) {
    return false;
  }

  try {
    const error = new (
      value as new (
        ...args: unknown[]
      ) => Error & {
        exitCode?: unknown;
      }
    )("Collection startup validation", null);
    return error.exitCode === expected;
  } catch {
    return false;
  }
}

async function runCollect(args: readonly string[]): Promise<void> {
  let collectionModules: [
    typeof import("./domain/input.js"),
    typeof import("./errors.js"),
  ];

  try {
    const modules = await Promise.all([
      import("./domain/input.js"),
      import("./errors.js"),
    ]);
    const [inputModule, errorModule] = modules;
    if (
      typeof inputModule.parseCollectInput !== "function" ||
      !isErrorConstructor(errorModule.InputError) ||
      !isErrorConstructor(errorModule.OperationalError) ||
      !isErrorConstructor(errorModule.RequiredCollectionError) ||
      !hasExitCode(errorModule.InputError, 2) ||
      !hasExitCode(errorModule.OutOfScopeError, 2) ||
      !hasExitCode(errorModule.RequiredCollectionError, 3) ||
      !hasExitCode(errorModule.PartialCollectionError, 4) ||
      !hasExitCode(errorModule.OutputWriteError, 5) ||
      typeof errorModule.sanitizeErrorMessage !== "function"
    ) {
      throw new Error("Invalid collection module exports.");
    }
    collectionModules = modules;
  } catch {
    reportCollectionStartupFailure();
    return;
  }

  const [{ parseCollectInput }, errorModule] = collectionModules;
  const {
    InputError,
    OperationalError,
    RequiredCollectionError,
    sanitizeErrorMessage,
  } = errorModule;

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

await main().catch(reportCollectionStartupFailure);
