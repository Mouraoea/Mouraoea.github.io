import { getJoinedMarketData } from "../fetcher/join.ts";
import { GOLD_ROW, type MarketSnapshot } from "../fetcher/types.ts";
import { currentMonthKey } from "./market-archive.ts";

function dayKeyUtc(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function fetchLiveMarketSnapshot(): Promise<MarketSnapshot> {
  const now = new Date();
  const items = [GOLD_ROW, ...(await getJoinedMarketData())];

  return {
    date: dayKeyUtc(now),
    capturedAt: now.toISOString(),
    items,
  };
}

export function liveSnapshotMonth(snapshot: MarketSnapshot): string {
  return snapshot.date.slice(0, 7) || currentMonthKey();
}
