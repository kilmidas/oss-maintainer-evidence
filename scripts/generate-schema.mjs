import { writeFileSync } from "node:fs";
import { reportSchema } from "../dist/domain/report.js";
import { execFileSync } from "node:child_process";

const output = process.argv[2] ?? "schema/report-v1.json";
const schema = reportSchema.toJSONSchema({ target: "draft-2020-12" });
schema.title = "OSS Maintainer Evidence Report v1";
writeFileSync(output, `${JSON.stringify(schema, null, 2)}\n`);
execFileSync("npx", ["biome", "format", "--write", output], {
  stdio: "ignore",
});
