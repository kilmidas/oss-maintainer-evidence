import { type Report, reportSchema } from "../domain/report.js";

export function renderJson(report: Report): string {
  return `${JSON.stringify(reportSchema.parse(report), null, 2)}\n`;
}
