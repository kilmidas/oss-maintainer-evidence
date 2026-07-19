import { spawnSync } from "node:child_process";
import { statSync } from "node:fs";
import { basename, isAbsolute } from "node:path";

function isExistingFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

export function resolveNpmExecPath(npmExecPath: string | undefined): string {
  if (npmExecPath === undefined || npmExecPath.length === 0) {
    throw new Error("Tests must run through npm: npm_execpath is missing.");
  }

  if (
    !isAbsolute(npmExecPath) ||
    basename(npmExecPath) !== "npm-cli.js" ||
    !isExistingFile(npmExecPath)
  ) {
    throw new Error(
      "Tests require npm_execpath to reference an existing npm-cli.js file.",
    );
  }

  return npmExecPath;
}

export function runNpm(args: readonly string[], cwd: string) {
  const npmExecPath = resolveNpmExecPath(process.env.npm_execpath);

  return spawnSync(process.execPath, [npmExecPath, ...args], {
    cwd,
    encoding: "utf8",
    shell: false,
  });
}
