import { decompressTextToJson } from "./compression.browser.ts";
import { isArchiveFileContent } from "./compression.shared.ts";
import type { MarketSnapshot, MonthlyArchive } from "../fetcher/types.ts";

export function currentMonthKey(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/** Shift a `YYYY-MM` key by a whole number of months (negative = older). */
export function shiftMonthKey(month: string, deltaMonths: number): string {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
    throw new Error(`Invalid month key: ${month}`);
  }
  return currentMonthKey(new Date(Date.UTC(year, monthIndex + deltaMonths, 1)));
}

export function previousMonthKey(month: string): string {
  return shiftMonthKey(month, -1);
}

export function earliestMonthFromSnapshots(
  snapshots: MarketSnapshot[],
): string | null {
  if (snapshots.length === 0) return null;
  return snapshots[0].capturedAt.slice(0, 7);
}

export function mergeArchives(archives: MonthlyArchive[]): MonthlyArchive {
  const byCapturedAt = new Map<string, MarketSnapshot>();

  for (const archive of archives) {
    for (const snapshot of archive.snapshots) {
      byCapturedAt.set(snapshot.capturedAt, snapshot);
    }
  }

  const snapshots = [...byCapturedAt.values()].sort((a, b) =>
    a.capturedAt.localeCompare(b.capturedAt),
  );
  const months = archives.map((archive) => archive.month).sort();

  return {
    version: 1,
    month: months.at(-1) ?? currentMonthKey(),
    snapshots,
  };
}

const missingArchiveMessage = (month: string) =>
  `No archive for month ${month} yet. Data is updated automatically on deploy or daily via GitHub Actions.`;

async function parseArchiveResponse(
  month: string,
  response: Response,
): Promise<MonthlyArchive | null> {
  if (response.status === 404) return null;

  if (!response.ok) {
    throw new Error(`Failed to load archive (${response.status})`);
  }

  const text = await response.text();

  if (!isArchiveFileContent(text)) return null;

  const archive = await decompressTextToJson<MonthlyArchive>(text);

  if (archive.version !== 1 || !Array.isArray(archive.snapshots)) {
    throw new Error(`Invalid archive format for month ${month}`);
  }

  return archive;
}

/** Load a monthly archive, or `null` when the file is missing. */
export async function loadMonthlyArchiveIfExists(
  month: string,
  options?: { bustCache?: boolean },
): Promise<MonthlyArchive | null> {
  const cacheBust = options?.bustCache ? `?t=${Date.now()}` : "";
  const response = await fetch(`/data/market/${month}.txt${cacheBust}`);
  return parseArchiveResponse(month, response);
}

export async function loadMonthlyArchive(
  month: string,
  options?: { bustCache?: boolean },
): Promise<MonthlyArchive> {
  const archive = await loadMonthlyArchiveIfExists(month, options);
  if (!archive) {
    throw new Error(missingArchiveMessage(month));
  }
  return archive;
}

/**
 * Load the current month plus `monthsBack` prior months (default 1).
 * The current month is required; older months are skipped if missing.
 */
export async function loadRecentMarketArchives(options?: {
  monthsBack?: number;
  bustCache?: boolean;
  asOf?: Date;
}): Promise<{ archive: MonthlyArchive; loadedMonths: string[] }> {
  const monthsBack = options?.monthsBack ?? 1;
  const current = currentMonthKey(options?.asOf);
  const months = Array.from({ length: monthsBack + 1 }, (_, index) =>
    shiftMonthKey(current, -index),
  );

  const [currentArchive, ...olderResults] = await Promise.all([
    loadMonthlyArchive(months[0], options),
    ...months
      .slice(1)
      .map((month) => loadMonthlyArchiveIfExists(month, options)),
  ]);

  const loaded = [
    currentArchive,
    ...olderResults.filter((archive): archive is MonthlyArchive => archive !== null),
  ];

  return {
    archive: mergeArchives(loaded),
    loadedMonths: loaded
      .map((archive) => archive.month)
      .sort((a, b) => a.localeCompare(b)),
  };
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
