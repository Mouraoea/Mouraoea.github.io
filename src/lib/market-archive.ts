import { decompressTextToJson } from "./compression.browser.ts";
import { isArchiveFileContent } from "./compression.shared.ts";
import type { MarketSnapshot, MonthlyArchive } from "../fetcher/types.ts";

export function currentMonthKey(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

const missingArchiveMessage = (month: string) =>
  `No archive for month ${month} yet. Data is updated automatically on deploy or daily via GitHub Actions.`;

export async function loadMonthlyArchive(
  month: string,
  options?: { bustCache?: boolean },
): Promise<MonthlyArchive> {
  const cacheBust = options?.bustCache ? `?t=${Date.now()}` : "";
  const response = await fetch(`/data/market/${month}.txt${cacheBust}`);

  if (response.status === 404) {
    throw new Error(missingArchiveMessage(month));
  }

  if (!response.ok) {
    throw new Error(`Failed to load archive (${response.status})`);
  }

  const text = await response.text();

  if (!isArchiveFileContent(text)) {
    throw new Error(missingArchiveMessage(month));
  }

  const archive = await decompressTextToJson<MonthlyArchive>(text);

  if (archive.version !== 1 || !Array.isArray(archive.snapshots)) {
    throw new Error(`Invalid archive format for month ${month}`);
  }

  return archive;
}

export function findSnapshotByKey(
  snapshots: MarketSnapshot[],
  key: string,
): MarketSnapshot | undefined {
  return (
    snapshots.find((snapshot) => snapshot.capturedAt === key) ??
    snapshots.find((snapshot) => snapshot.date === key)
  );
}

export function snapshotSelectKey(snapshot: MarketSnapshot): string {
  return snapshot.capturedAt;
}

export function formatSnapshotOptionLabel(
  snapshot: MarketSnapshot,
  snapshots: MarketSnapshot[],
  locale: string,
): string {
  const sameDayCount = snapshots.filter((entry) => entry.date === snapshot.date).length;
  if (sameDayCount <= 1) return snapshot.date;

  const time = new Date(snapshot.capturedAt).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
  return `${snapshot.date} ${time}`;
}
