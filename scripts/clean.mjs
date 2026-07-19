import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const outputDirectories = [
  fileURLToPath(new URL("../dist/", import.meta.url)),
  fileURLToPath(new URL("../.test-dist/", import.meta.url)),
];

for (const outputDirectory of outputDirectories) {
  rmSync(outputDirectory, { recursive: true, force: true });
}
