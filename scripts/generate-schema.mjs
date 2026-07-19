import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { reportSchema } from "../dist/domain/report.js";

const output = process.argv[2] ?? "schema/report-v1.json";
const schema = reportSchema.toJSONSchema({ target: "draft-2020-12" });
schema.title = "OSS Maintainer Evidence Report v1";
const raw = `${JSON.stringify(schema, null, 2)}\n`;
const formatted = execFileSync("node_modules/.bin/biome", ["format", "--stdin-file-path", output], { input: raw, encoding: "utf8" });
writeFileSync(output, formatted);
