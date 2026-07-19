const REDACTION = "[REDACTED]";
const AUTHORIZATION_HEADER = /(\bauthorization[ \t]*:[ \t]*)[^\r\n]*/gi;
const BEARER_CREDENTIAL = /\b(Bearer)[ \t]+\S+/gi;
const GITHUB_TOKEN =
  /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g;
const OPENAI_KEY = /\bsk-[A-Za-z0-9_-]{20,}\b/g;

export type OperationalExitCode = 2 | 3 | 4 | 5;

export function sanitizeErrorMessage(message: string): string {
  return message
    .replace(AUTHORIZATION_HEADER, `$1${REDACTION}`)
    .replace(BEARER_CREDENTIAL, `$1 ${REDACTION}`)
    .replace(GITHUB_TOKEN, REDACTION)
    .replace(OPENAI_KEY, REDACTION);
}

function replaceControlCharacters(message: string): string {
  return Array.from(message, (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)
      ? " "
      : character;
  }).join("");
}

function conciseSafeMessage(message: string): string {
  const concise = replaceControlCharacters(sanitizeErrorMessage(message))
    .replace(/\s+/g, " ")
    .trim();
  return concise.length === 0 ? "Operation failed." : concise;
}

export abstract class OperationalError extends Error {
  abstract readonly exitCode: OperationalExitCode;

  protected constructor(name: string, message: string) {
    super(conciseSafeMessage(message));
    this.name = name;
  }
}

export class InputError extends OperationalError {
  readonly exitCode = 2 as const;

  constructor(message: string) {
    super("InputError", message);
  }
}

export class OutOfScopeError extends OperationalError {
  readonly exitCode = 2 as const;

  constructor(message: string) {
    super("OutOfScopeError", message);
  }
}

export class RequiredCollectionError extends OperationalError {
  readonly exitCode = 3 as const;

  constructor(message: string) {
    super("RequiredCollectionError", message);
  }
}

export class PartialCollectionError<TReport> extends OperationalError {
  readonly exitCode = 4 as const;

  constructor(
    message: string,
    readonly report: TReport,
  ) {
    super("PartialCollectionError", message);
  }
}

export class OutputWriteError extends OperationalError {
  readonly exitCode = 5 as const;

  constructor(message: string) {
    super("OutputWriteError", message);
  }
}
