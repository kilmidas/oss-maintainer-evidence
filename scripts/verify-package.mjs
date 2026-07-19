import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const temporaryRoot = mkdtempSync(join(tmpdir(), "oss-evidence-package-"));

try {
  const npmExecPath = process.env.npm_execpath;
  if (
    npmExecPath === undefined ||
    !isAbsolute(npmExecPath) ||
    basename(npmExecPath) !== "npm-cli.js" ||
    !existsSync(npmExecPath) ||
    !statSync(npmExecPath).isFile()
  ) {
    throw new Error("npm_execpath must reference an existing npm-cli.js file");
  }

  const metadata = JSON.parse(
    readFileSync(join(projectRoot, "package.json"), "utf8"),
  );
  if (
    metadata.name !== "oss-evidence" ||
    typeof metadata.version !== "string"
  ) {
    throw new Error("package metadata has an unexpected name or version");
  }

  const artifacts = join(temporaryRoot, "artifacts");
  const installation = join(temporaryRoot, "installation");
  mkdirSync(artifacts);
  mkdirSync(installation);
  writeFileSync(
    join(installation, "package.json"),
    '{"name":"oss-evidence-package-smoke","private":true}\n',
  );

  runNpm(
    npmExecPath,
    ["pack", "--pack-destination", artifacts, "--json"],
    projectRoot,
  );
  const archive = join(artifacts, `${metadata.name}-${metadata.version}.tgz`);
  if (!existsSync(archive) || !statSync(archive).isFile()) {
    throw new Error("npm pack did not create the expected archive");
  }

  runNpm(
    npmExecPath,
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", archive],
    installation,
  );

  const installedCli = join(
    installation,
    "node_modules",
    metadata.name,
    "dist",
    "cli.js",
  );
  const help = run(process.execPath, [installedCli, "--help"], installation);
  if (!help.stdout.startsWith("Usage: oss-evidence collect ")) {
    throw new Error("installed archive returned unexpected help output");
  }
  const version = run(
    process.execPath,
    [installedCli, "--version"],
    installation,
  );
  if (version.stdout.trim() !== metadata.version) {
    throw new Error("installed archive returned an unexpected version");
  }

  process.stdout.write(`Verified ${basename(archive)} help and version.\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : "unknown error";
  process.stderr.write(`Package verification failed: ${message}\n`);
  process.exitCode = 1;
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

function runNpm(npmExecPath, args, cwd) {
  return run(process.execPath, [npmExecPath, ...args], cwd);
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    shell: false,
    maxBuffer: 8 * 1024 * 1024,
    timeout: 120_000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = result.stderr.trim().split("\n").at(-1) || "command failed";
    throw new Error(`${basename(command)} exited ${result.status}: ${detail}`);
  }
  return result;
}
