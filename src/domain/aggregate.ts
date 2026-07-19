import { type Report, reportSchema } from "./report.js";

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const stable = (v: unknown): string => {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  return `{${Object.keys(v as Record<string, unknown>)
    .sort(cmp)
    .map(
      (k) =>
        `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`,
    )
    .join(",")}}`;
};
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
          (list as Array<Record<string, unknown>>)
            .slice()
            .sort((a, b) => cmp(stable(a), stable(b)))
            .map((a) => [`${a.type}:${a.id}`, a]),
        ).values(),
      ].sort(
        (a, b) =>
          cmp(String(b.occurredAt), String(a.occurredAt)) ||
          cmp(String(a.type), String(b.type)) ||
          cmp(String(a.id), String(b.id)),
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
