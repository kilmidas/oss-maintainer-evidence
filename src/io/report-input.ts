import { open } from "node:fs/promises";
import { TextDecoder } from "node:util";

import { InputError } from "../errors.js";

const MAX_REPORT_BYTES = 5 * 1024 * 1024;
const READ_CHUNK_BYTES = 64 * 1024;

export async function readReportJson(path: string): Promise<unknown> {
  let handle;
  try {
    handle = await open(path, "r");
    const chunks: Buffer[] = [];
    let total = 0;

    while (total <= MAX_REPORT_BYTES) {
      const remaining = Math.min(
        READ_CHUNK_BYTES,
        MAX_REPORT_BYTES + 1 - total,
      );
      const chunk = Buffer.allocUnsafe(remaining);
      const { bytesRead } = await handle.read(chunk, 0, remaining, null);
      if (bytesRead === 0) break;
      chunks.push(chunk.subarray(0, bytesRead));
      total += bytesRead;
    }

    if (total > MAX_REPORT_BYTES) {
      throw new InputError("Report file exceeds the 5 MiB limit.");
    }

    const text = new TextDecoder("utf-8", { fatal: true }).decode(
      Buffer.concat(chunks, total),
    );
    return JSON.parse(text) as unknown;
  } catch (error) {
    if (error instanceof InputError) throw error;
    throw new InputError("Report file could not be read as valid JSON.");
  } finally {
    await handle?.close().catch(() => undefined);
  }
}
