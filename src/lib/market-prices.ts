import type { MarketItemRow, MarketSnapshot } from "../fetcher/types.ts";

export type TradePolicy = "highest_profit" | "average_prices" | "fast_trade";

export const TRADE_POLICY_OPTIONS: { value: TradePolicy }[] = [
  { value: "highest_profit" },
  { value: "average_prices" },
  { value: "fast_trade" },
];

export function buildPriceMap(
  snapshot: MarketSnapshot,
): Map<string, MarketItemRow> {
  const map = new Map<string, MarketItemRow>();
  for (const item of snapshot.items) {
    map.set(item.name_id, item);
  }
  return map;
}

/** 24h average from history_1d, or midpoint of bid/ask when missing. */
export function getAveragePrice(row: MarketItemRow): number | null {
  if (row.history_1d !== null && row.history_1d > 0) {
    return row.history_1d;
  }
  if (row.lowestSellPrice > 0 && row.highestBuyPrice > 0) {
    return (row.lowestSellPrice + row.highestBuyPrice) / 2;
  }
  return null;
}

export function getBuyPrice(row: MarketItemRow, policy: TradePolicy): number {
  switch (policy) {
    case "average_prices": {
      const average = getAveragePrice(row);
      if (average !== null) return average;
      return getBuyPrice(row, "highest_profit");
    }
    case "highest_profit":
      return row.highestBuyPrice;
    case "fast_trade":
      return row.lowestSellPrice;
  }
}

export function getSellPrice(row: MarketItemRow, policy: TradePolicy): number {
  switch (policy) {
    case "average_prices": {
      const average = getAveragePrice(row);
      if (average !== null) return average;
      return getSellPrice(row, "highest_profit");
    }
    case "highest_profit":
      return row.lowestSellPrice;
    case "fast_trade":
      return row.highestBuyPrice;
  }
}

export function lookupItem(
  priceMap: Map<string, MarketItemRow>,
  nameId: string,
): MarketItemRow | undefined {
  return priceMap.get(nameId);
}
