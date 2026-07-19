#!/usr/bin/env node

import { getVersion } from "./version.js";

const HELP_TEXT = `Usage: oss-evidence collect owner/repository --maintainer username
       oss-evidence verify <report.json>

Options:
  --since <90d|ISO_TIMESTAMP>  Inclusive reporting-window start (default: 90d)
  --format <markdown|json>     Output format (default: markdown)
  --output <PATH>              Create a new output file instead of stdout
  --max-items <1..1000>        Maximum items per paginated resource (default: 200)
  --help                       Show command help
  --version                    Show the package version
`;

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

function reportVerificationStartupFailure(): void {
  process.stderr.write("Unable to start verification. Reinstall oss-evidence.\n");
  process.exitCode = 1;
}

function isFunction(value: unknown): value is (...args: never[]) => unknown {
  return typeof value === "function";
}

async function runCollect(args: readonly string[]): Promise<void> {
  let modules: [
    typeof import("./domain/input.js"),
    typeof import("./errors.js"),
    typeof import("./app/runtime.js"),
    typeof import("./render/markdown.js"),
    typeof import("./render/json.js"),
    typeof import("./io/output.js"),
  ];
  try {
    modules = await Promise.all([
      import("./domain/input.js"),
      import("./errors.js"),
      import("./app/runtime.js"),
      import("./render/markdown.js"),
      import("./render/json.js"),
      import("./io/output.js"),
    ]);
    if (
      !isFunction(modules[0].parseCollectInput) ||
      !isFunction(modules[2].runCollection) ||
      !isFunction(modules[3].renderMarkdown) ||
      !isFunction(modules[4].renderJson) ||
      !isFunction(modules[5].writeOutput) ||
      !isFunction(modules[1].sanitizeErrorMessage)
    )
      throw new Error("invalid runtime modules");
  } catch {
    reportCollectionStartupFailure();
    return;
  }

  const [inputModule, errorModule, runtime, markdown, json, output] = modules;
  try {
    const input = inputModule.parseCollectInput(args, new Date());
    const report = await runtime.runCollection(input);
    const rendered =
      input.format === "json"
        ? json.renderJson(report)
        : markdown.renderMarkdown(report);
    await output.writeOutput(rendered, input.output);
    if (report.status === "partial") {
      const partial = new errorModule.PartialCollectionError(
        "Report generated with partial public GitHub evidence.",
        report,
      );
      process.stderr.write(`${partial.message}\n`);
      process.exitCode = partial.exitCode;
    }
  } catch (error) {
    const operational =
      error instanceof errorModule.OperationalError
        ? error
        : new errorModule.RequiredCollectionError(
            "Required public GitHub evidence could not be collected.",
          );
    process.stderr.write(
      `${errorModule.sanitizeErrorMessage(operational.message)}\n`,
    );
    process.exitCode = operational.exitCode;
  }
}

async function runVerify(args: readonly string[]): Promise<void> {
  let modules: [
    typeof import("./domain/input.js"),
    typeof import("./errors.js"),
    typeof import("./io/report-input.js"),
    typeof import("./domain/verification.js"),
    typeof import("./app/verify.js"),
    typeof import("./render/verification.js"),
  ];
  try {
    modules = await Promise.all([
      import("./domain/input.js"),
      import("./errors.js"),
      import("./io/report-input.js"),
      import("./domain/verification.js"),
      import("./app/verify.js"),
      import("./render/verification.js"),
    ]);
    if (
      !isFunction(modules[0].parseVerifyInput) ||
      !isFunction(modules[1].OperationalError) ||
      !isFunction(modules[1].VerificationFailedError) ||
      !isFunction(modules[1].sanitizeErrorMessage) ||
      !isFunction(modules[2].readReportJson) ||
      !isFunction(modules[3].createVerificationPlan) ||
      !isFunction(modules[4].runVerification) ||
      !isFunction(modules[5].renderVerification)
    )
      throw new Error("invalid verification modules");
  } catch {
    reportVerificationStartupFailure();
    return;
  }

  const [inputModule, errorModule, reportInput, verification, app, render] =
    modules;
  try {
    const input = inputModule.parseVerifyInput(args);
    const value = await reportInput.readReportJson(input.reportPath);
    const plan = verification.createVerificationPlan(value);
    const report = await app.runVerification(plan);
    process.stdout.write(render.renderVerification(report));
    if (report.status === "failed") {
      const failure = new errorModule.VerificationFailedError(
        "One or more evidence links could not be verified.",
        report,
      );
      process.exitCode = failure.exitCode;
    }
  } catch (error) {
    const operational =
      error instanceof errorModule.OperationalError
        ? error
        : new errorModule.VerificationFailedError(
            "Evidence link verification could not be completed.",
            undefined,
          );
    process.stderr.write(
      `${errorModule.sanitizeErrorMessage(operational.message)}\n`,
    );
    process.exitCode = operational.exitCode;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--help") {
    process.stdout.write(HELP_TEXT);
  } else if (args.length === 1 && args[0] === "--version") {
    try {
      process.stdout.write(`${getVersion()}\n`);
    } catch {
      reportPackageMetadataFailure();
    }
  } else if (args[0] === "verify") await runVerify(args);
  else await runCollect(args);
}

await main().catch(reportCollectionStartupFailure);
