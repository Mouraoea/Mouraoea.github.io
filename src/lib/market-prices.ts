import type { MarketItemRow, MarketSnapshot } from "../fetcher/types.ts";

export function buildPriceMap(
  snapshot: MarketSnapshot,
): Map<string, MarketItemRow> {
  const map = new Map<string, MarketItemRow>();
  for (const item of snapshot.items) {
    map.set(item.name_id, item);
  }
  return map;
}

export function getBuyPrice(
  row: MarketItemRow,
  instantBuy: boolean,
): number {
  return instantBuy ? row.lowestSellPrice : row.highestBuyPrice;
}

export function getSellPrice(
  row: MarketItemRow,
  instantSell: boolean,
): number {
  return instantSell ? row.highestBuyPrice : row.lowestSellPrice;
}

export function lookupItem(
  priceMap: Map<string, MarketItemRow>,
  nameId: string,
): MarketItemRow | undefined {
  return priceMap.get(nameId);
}
