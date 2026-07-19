import { InputError } from "../errors.js";

export type OutputFormat = "markdown" | "json";

export interface RepositoryInput {
  owner: string;
  name: string;
  fullName: string;
}

export interface CollectInput {
  repository: RepositoryInput;
  maintainer: string;
  since: string;
  until: string;
  format: OutputFormat;
  output?: string;
  maxItems: number;
}

const DEFAULT_SINCE = "90d";
const DEFAULT_FORMAT: OutputFormat = "markdown";
const DEFAULT_MAX_ITEMS = 200;
const MAX_ITEMS = 1000;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const ACCOUNT_NAME = /^[A-Za-z0-9-]{1,39}$/;
const REPOSITORY_NAME = /^[A-Za-z0-9._-]{1,100}$/;
const ABSOLUTE_TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?([Zz]|([+-])(\d{2}):(\d{2}))$/;

const OPTIONS = new Set([
  "--maintainer",
  "--since",
  "--format",
  "--output",
  "--max-items",
]);

function invalidInput(message: string): InputError {
  return new InputError(message);
}

function isAccountName(value: string): boolean {
  return (
    ACCOUNT_NAME.test(value) &&
    !value.startsWith("-") &&
    !value.endsWith("-") &&
    !value.includes("--")
  );
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f);
  });
}

function parseRepository(value: string): RepositoryInput {
  const parts = value.split("/");
  if (parts.length !== 2) {
    throw invalidInput("Repository must use the owner/repository form.");
  }

  const [owner, name] = parts;
  if (owner === undefined || !isAccountName(owner)) {
    throw invalidInput("Repository owner is invalid.");
  }
  if (
    name === undefined ||
    !REPOSITORY_NAME.test(name) ||
    name.startsWith("-") ||
    name === "." ||
    name === ".."
  ) {
    throw invalidInput("Repository name is invalid.");
  }

  return { owner, name, fullName: `${owner}/${name}` };
}

function parseRelativeSince(
  value: string,
  untilMilliseconds: number,
): string | undefined {
  const match = /^([1-9]\d*)d$/.exec(value);
  if (match === null) {
    return undefined;
  }

  const days = Number(match[1]);
  if (!Number.isSafeInteger(days)) {
    throw invalidInput(
      "Since must be a positive number of days or a timestamp.",
    );
  }

  const since = new Date(untilMilliseconds - days * MILLISECONDS_PER_DAY);
  if (!Number.isFinite(since.getTime())) {
    throw invalidInput("Since falls outside the supported date range.");
  }

  return since.toISOString();
}

function parseAbsoluteSince(value: string, untilMilliseconds: number): string {
  const match = ABSOLUTE_TIMESTAMP.exec(value);
  if (match === null) {
    throw invalidInput(
      "Since must be a positive number of days or a timezone timestamp.",
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const isLeapSecond = second === 60;
  const normalizedSecond = isLeapSecond ? 59 : second;
  const fractionalSeconds = match[7] ?? "";
  const millisecond = Number(fractionalSeconds.padEnd(3, "0").slice(0, 3));
  const zone = match[8];
  const offsetHour = Number(match[10] ?? "0");
  const offsetMinute = Number(match[11] ?? "0");

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59 ||
    second > 60 ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    throw invalidInput("Since timestamp is invalid.");
  }

  const wallClock = new Date(0);
  wallClock.setUTCFullYear(year, month - 1, day);
  wallClock.setUTCHours(hour, minute, normalizedSecond, millisecond);
  if (
    wallClock.getUTCFullYear() !== year ||
    wallClock.getUTCMonth() !== month - 1 ||
    wallClock.getUTCDate() !== day ||
    wallClock.getUTCHours() !== hour ||
    wallClock.getUTCMinutes() !== minute ||
    wallClock.getUTCSeconds() !== normalizedSecond
  ) {
    throw invalidInput("Since timestamp is invalid.");
  }

  const offsetSign = match[9] === "-" ? -1 : 1;
  const offsetMilliseconds =
    zone === "Z" || zone === "z"
      ? 0
      : offsetSign * (offsetHour * 60 + offsetMinute) * 60 * 1000;
  const normalizedMilliseconds = wallClock.getTime() - offsetMilliseconds;
  if (isLeapSecond) {
    const beforeLeapSecond = new Date(normalizedMilliseconds);
    const afterLeapSecond = new Date(normalizedMilliseconds + 1000);
    if (
      beforeLeapSecond.getUTCHours() !== 23 ||
      beforeLeapSecond.getUTCMinutes() !== 59 ||
      beforeLeapSecond.getUTCSeconds() !== 59 ||
      afterLeapSecond.getUTCDate() !== 1 ||
      afterLeapSecond.getUTCHours() !== 0 ||
      afterLeapSecond.getUTCMinutes() !== 0 ||
      afterLeapSecond.getUTCSeconds() !== 0
    ) {
      throw invalidInput("Since timestamp is invalid.");
    }
  }
  const since = new Date(normalizedMilliseconds + (isLeapSecond ? 1000 : 0));
  const sinceMilliseconds = since.getTime();

  if (!Number.isFinite(sinceMilliseconds)) {
    throw invalidInput("Since timestamp is invalid.");
  }
  if (sinceMilliseconds > untilMilliseconds) {
    throw invalidInput("Since must not be later than the collection start.");
  }

  return since.toISOString();
}

function parseSince(value: string, untilMilliseconds: number): string {
  const relativeSince = parseRelativeSince(value, untilMilliseconds);
  return relativeSince ?? parseAbsoluteSince(value, untilMilliseconds);
}

function parseMaxItems(value: string): number {
  if (!/^[1-9]\d*$/.test(value)) {
    throw invalidInput("Max items must be an integer from 1 through 1000.");
  }

  const maxItems = Number(value);
  if (!Number.isSafeInteger(maxItems) || maxItems > MAX_ITEMS) {
    throw invalidInput("Max items must be an integer from 1 through 1000.");
  }
  return maxItems;
}

export function parseCollectInput(
  argv: readonly string[],
  now: Date,
): CollectInput {
  const untilMilliseconds = now.getTime();
  if (!Number.isFinite(untilMilliseconds)) {
    throw invalidInput("Collection start time is invalid.");
  }
  if (argv[0] !== "collect" || argv[1] === undefined) {
    throw invalidInput(
      "Expected collect owner/repository --maintainer username.",
    );
  }

  const repository = parseRepository(argv[1]);
  const values = new Map<string, string>();

  for (let index = 2; index < argv.length; index += 2) {
    const option = argv[index];
    const value = argv[index + 1];
    if (option === undefined || !OPTIONS.has(option)) {
      throw invalidInput("Unknown command option.");
    }
    if (values.has(option)) {
      throw invalidInput("Command options must not be repeated.");
    }
    if (value === undefined) {
      throw invalidInput("Command option value is missing.");
    }
    values.set(option, value);
  }

  const maintainer = values.get("--maintainer");
  if (maintainer === undefined || !isAccountName(maintainer)) {
    throw invalidInput("Maintainer account name is invalid.");
  }

  const format = values.get("--format") ?? DEFAULT_FORMAT;
  if (format !== "markdown" && format !== "json") {
    throw invalidInput("Format must be markdown or json.");
  }

  const output = values.get("--output");
  if (
    output !== undefined &&
    (output.length === 0 || hasControlCharacter(output))
  ) {
    throw invalidInput(
      "Output path must be nonempty and free of control characters.",
    );
  }

  const until = new Date(untilMilliseconds).toISOString();
  const since = parseSince(
    values.get("--since") ?? DEFAULT_SINCE,
    untilMilliseconds,
  );
  const maxItems = parseMaxItems(
    values.get("--max-items") ?? String(DEFAULT_MAX_ITEMS),
  );

  return {
    repository,
    maintainer,
    since,
    until,
    format,
    ...(output === undefined ? {} : { output }),
    maxItems,
  };
}
