import { writeFileSync } from "node:fs";
import { reportSchema } from "../dist/domain/report.js";
const schema = reportSchema.toJSONSchema({ target: "draft-2020-12" });
schema.title = "OSS Maintainer Evidence Report v1";
writeFileSync("schema/report-v1.json", `${JSON.stringify(schema, null, 2)}\n`);
