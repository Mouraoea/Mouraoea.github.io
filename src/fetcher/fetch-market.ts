import path from "node:path";
import { getJoinedMarketData } from "./join.ts";
import { GOLD_ROW } from "./types.ts";
import {
  dayKey,
  monthFilePath,
  monthKey,
  readMonthlyArchive,
  upsertSnapshot,
  writeMonthlyArchive,
} from "../lib/storage.ts";

export interface FetchMarketOptions {
  dataDir?: string;
  dryRun?: boolean;
  now?: Date;
}

export interface FetchMarketResult {
  month: string;
  date: string;
  itemCount: number;
  snapshotCount: number;
  filePath: string;
  fileSizeBytes: number | null;
  dryRun: boolean;
}

export async function fetchAndStoreMarket(
  options: FetchMarketOptions = {},
): Promise<FetchMarketResult> {
  const now = options.now ?? new Date();
  const dataDir = path.resolve(options.dataDir ?? "./public/data/market");
  const dryRun = options.dryRun ?? false;

  const joined = await getJoinedMarketData();
  const items = [GOLD_ROW, ...joined];

  const month = monthKey(now);
  const date = dayKey(now);
  const snapshot = {
    date,
    capturedAt: now.toISOString(),
    items,
  };

  const filePath = monthFilePath(dataDir, month);

  if (dryRun) {
    return {
      month,
      date,
      itemCount: items.length,
      snapshotCount: 0,
      filePath,
      fileSizeBytes: null,
      dryRun: true,
    };
  }

  const archive = await readMonthlyArchive(filePath, month);
  archive.month = month;
  const updated = upsertSnapshot(archive, snapshot);
  await writeMonthlyArchive(filePath, updated);

  const { stat } = await import("node:fs/promises");
  const fileStat = await stat(filePath);

  return {
    month,
    date,
    itemCount: items.length,
    snapshotCount: updated.snapshots.length,
    filePath,
    fileSizeBytes: fileStat.size,
    dryRun: false,
  };
}
