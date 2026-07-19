import { type Report, reportSchema } from "./report.js";

export { reportSchema } from "./report.js";
export function aggregateEvidence(
  input: Omit<Report, "schemaVersion" | "generatedAt" | "summary"> & {
    summary?: unknown;
    generatedAt?: string;
    schemaVersion?: string;
  },
): Report {
  const activities = Object.fromEntries(
    Object.entries(input.activities).map(([key, list]) => [
      key,
      [
        ...new Map(
          (list as Array<Record<string, unknown>>).map((a) => [
            `${a.type}:${a.id}`,
            a,
          ]),
        ).values(),
      ].sort(
        (a, b) =>
          String(b.occurredAt).localeCompare(String(a.occurredAt)) ||
          String(a.type).localeCompare(String(b.type)) ||
          String(a.id).localeCompare(String(b.id)),
      ),
    ]),
  ) as Report["activities"];
  const counts = Object.fromEntries(
    Object.entries(activities).map(([k, v]) => [k, (v as unknown[]).length]),
  );
  return reportSchema.parse({
    ...input,
    schemaVersion: "1.0",
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    activities,
    summary: {
      ...counts,
      total: Object.values(counts).reduce((a, b) => a + b, 0),
    },
  });
}
