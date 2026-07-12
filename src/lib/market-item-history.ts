import type { MarketSnapshot } from "../fetcher/types.ts";

export interface ItemHistoryPoint {
  date: string;
  time: number;
  highestBuyPrice: number;
  lowestSellPrice: number;
  history_1d: number | null;
  tradeVolume1Day: number | null;
}

export function computeSpread(bid: number | null, ask: number | null): number | null {
  if (bid === null || ask === null) return null;
  return ask - bid;
}

/** @deprecated Prefer buildSanitizedItemHistory from market-price-sanitize.ts */
export function buildItemHistory(
  snapshots: MarketSnapshot[],
  itemId: number,
): ItemHistoryPoint[] {
  const points: ItemHistoryPoint[] = [];

  for (const snapshot of snapshots) {
    const item = snapshot.items.find((row) => row.itemId === itemId);
    if (!item) continue;

    points.push({
      date: snapshot.date,
      time: Date.parse(snapshot.capturedAt),
      highestBuyPrice: item.highestBuyPrice,
      lowestSellPrice: item.lowestSellPrice,
      history_1d: item.history_1d,
      tradeVolume1Day: item.tradeVolume1Day,
    });
  }

  return points;
}
