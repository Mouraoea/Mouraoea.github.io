import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  compressJsonToText,
  decompressTextToJson,
  formatCompressedFile,
} from "./compression.ts";
import type { MarketSnapshot, MonthlyArchive } from "../fetcher/types.ts";

export function monthKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function dayKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function monthFilePath(dataDir: string, month: string): string {
  return path.join(dataDir, `${month}.txt`);
}

export function emptyMonthlyArchive(month: string): MonthlyArchive {
  return {
    version: 1,
    month,
    snapshots: [],
  };
}

export async function readMonthlyArchive(
  filePath: string,
  month: string,
): Promise<MonthlyArchive> {
  try {
    const content = await readFile(filePath, "utf-8");
    const archive = decompressTextToJson<MonthlyArchive>(content);
    if (archive.version !== 1 || !Array.isArray(archive.snapshots)) {
      throw new Error(`Invalid archive format in ${filePath}`);
    }
    return archive;
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return emptyMonthlyArchive(month);
    }
    throw error;
  }
}

export function upsertDailySnapshot(
  archive: MonthlyArchive,
  snapshot: MarketSnapshot,
): MonthlyArchive {
  const snapshots = archive.snapshots.filter((s) => s.date !== snapshot.date);
  snapshots.push(snapshot);
  snapshots.sort((a, b) => a.date.localeCompare(b.date));

  return {
    ...archive,
    month: archive.month,
    snapshots,
  };
}

export async function writeMonthlyArchive(
  filePath: string,
  archive: MonthlyArchive,
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const payload = compressJsonToText(archive);
  await writeFile(filePath, formatCompressedFile(payload), "utf-8");
}
