import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { link, open, unlink } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { OutputWriteError } from "../errors.js";

export async function writeOutput(
  content: string,
  path: string | undefined,
  stdout: { write(value: string): unknown } = process.stdout,
): Promise<void> {
  if (path === undefined) {
    stdout.write(content);
    return;
  }
  const directory = dirname(path);
  const temporary = join(
    directory,
    `.${basename(path)}.${randomBytes(8).toString("hex")}.tmp`,
  );
  try {
    const handle = await open(
      temporary,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
      0o600,
    );
    try {
      await handle.writeFile(content, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await link(temporary, path);
    await unlink(temporary);
  } catch {
    await unlink(temporary).catch(() => undefined);
    throw new OutputWriteError(
      "Output file could not be created. Choose a new writable path.",
    );
  }
}
