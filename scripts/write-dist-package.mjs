import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const distPackageFile = fileURLToPath(
  new URL("../dist/package.json", import.meta.url),
);

writeFileSync(
  distPackageFile,
  `${JSON.stringify({ type: "module" }, null, 2)}\n`,
);
