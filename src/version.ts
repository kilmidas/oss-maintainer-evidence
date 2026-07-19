import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PACKAGE_FILE = fileURLToPath(new URL("../package.json", import.meta.url));
const SEMANTIC_VERSION =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getVersion(): string {
  const packageMetadata: unknown = JSON.parse(
    readFileSync(PACKAGE_FILE, "utf8"),
  );

  if (!isRecord(packageMetadata) || packageMetadata.name !== "oss-evidence") {
    throw new Error("Invalid oss-evidence package metadata");
  }

  const { version } = packageMetadata;
  if (typeof version !== "string" || !SEMANTIC_VERSION.test(version)) {
    throw new Error("Invalid oss-evidence package version");
  }

  return version;
}
