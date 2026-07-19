import { existsSync, readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const approvedLicenses = new Set([
  "Apache-2.0",
  "MIT",
  "MIT OR Apache-2.0",
  "Apache-2.0 OR MIT",
]);

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
let root = projectRoot;
if (args.length > 0) {
  if (args.length !== 2 || args[0] !== "--root" || args[1].length === 0) {
    process.stderr.write("Usage: check-licenses.mjs [--root PROJECT_ROOT]\n");
    process.exitCode = 1;
  } else {
    root = resolve(args[1]);
  }
}

if (process.exitCode === undefined) {
  try {
    const lock = JSON.parse(
      readFileSync(resolve(root, "package-lock.json"), "utf8"),
    );
    if (lock === null || typeof lock !== "object" || lock.packages === null) {
      throw new Error("package-lock.json has no packages map");
    }

    const packages = [];
    for (const packagePath of Object.keys(lock.packages)) {
      if (!packagePath.startsWith("node_modules/")) continue;
      const metadataPath = resolve(root, packagePath, "package.json");
      if (!metadataPath.startsWith(`${resolve(root)}${sep}`)) {
        throw new Error("package path escapes the project root");
      }
      if (!existsSync(metadataPath)) continue;
      const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
      const name =
        typeof metadata.name === "string" && metadata.name.length > 0
          ? metadata.name
          : packagePath.slice("node_modules/".length);
      const version =
        typeof metadata.version === "string" && metadata.version.length > 0
          ? metadata.version
          : "unknown";
      packages.push({ name, version, license: metadata.license });
    }

    packages.sort((a, b) =>
      `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`),
    );
    const rejected = [];
    for (const entry of packages) {
      const id = `${entry.name}@${entry.version}`;
      if (
        typeof entry.license !== "string" ||
        !approvedLicenses.has(entry.license)
      ) {
        rejected.push(id);
        continue;
      }
      process.stdout.write(`${id}: ${entry.license}\n`);
    }
    if (rejected.length > 0) {
      for (const id of rejected) {
        process.stderr.write(`${id}: missing or unapproved license\n`);
      }
      process.exitCode = 1;
    } else if (packages.length === 0) {
      process.stderr.write("No installed dependency packages were found.\n");
      process.exitCode = 1;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    process.stderr.write(`License check failed: ${message}\n`);
    process.exitCode = 1;
  }
}
