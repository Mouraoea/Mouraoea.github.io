import type { MarketItemRow } from "../fetcher/types.ts";
import { translateNameId } from "../i18n/game-labels.ts";
import type { ItemTradingMetrics } from "./market-metrics.ts";

export type MarketSortKey =
  | "itemId"
  | "itemName"
  | "bid"
  | "bidDelta"
  | "ask"
  | "askDelta"
  | "prevClose"
  | "spreadPercent"
  | "vs7d"
  | "upsideScore"
  | "spreadScore"
  | "volume24h";

export type SortDirection = "asc" | "desc";

export type MarketTableColumn =
  | "item"
  | "upsideScore"
  | "spreadScore"
  | "bid"
  | "ask"
  | "prevClose"
  | "spreadPercent"
  | "vs7d"
  | "volume24h";

export const DEFAULT_MARKET_SORT: { key: MarketSortKey; direction: SortDirection } = {
  key: "itemId",
  direction: "asc",
};

export const COLUMN_SORT_SEQUENCE: Record<MarketTableColumn, MarketSortKey[]> = {
  item: ["itemId", "itemName"],
  upsideScore: ["upsideScore"],
  spreadScore: ["spreadScore"],
  bid: ["bid", "bidDelta"],
  ask: ["ask", "askDelta"],
  prevClose: ["prevClose"],
  spreadPercent: ["spreadPercent"],
  vs7d: ["vs7d"],
  volume24h: ["volume24h"],
};

export function isSortKeyInColumn(
  column: MarketTableColumn,
  sortKey: MarketSortKey,
): boolean {
  return COLUMN_SORT_SEQUENCE[column].includes(sortKey);
}

export function nextSortState(
  column: MarketTableColumn,
  current: { key: MarketSortKey; direction: SortDirection },
): { key: MarketSortKey; direction: SortDirection } {
  const sequence = COLUMN_SORT_SEQUENCE[column];

  if (!sequence.includes(current.key)) {
    return { key: sequence[0], direction: "asc" };
  }

  if (current.direction === "asc") {
    return { key: current.key, direction: "desc" };
  }

  const nextIndex = (sequence.indexOf(current.key) + 1) % sequence.length;
  return { key: sequence[nextIndex], direction: "asc" };
}

function sortValue(
  item: MarketItemRow,
  metrics: ItemTradingMetrics | undefined,
  sortKey: MarketSortKey,
): number | string | null {
  switch (sortKey) {
    case "itemId":
      return item.itemId;
    case "itemName":
      return translateNameId(item.name_id);
    case "bid":
      return metrics?.bid ?? null;
    case "bidDelta":
      return metrics?.bidDelta ?? null;
    case "ask":
      return metrics?.ask ?? null;
    case "askDelta":
      return metrics?.askDelta ?? null;
    case "prevClose":
      return metrics?.prevClose ?? null;
    case "spreadPercent":
      return metrics?.spreadPercent ?? null;
    case "vs7d":
      return metrics?.vs7d ?? null;
    case "upsideScore":
      return metrics?.upsideScore ?? null;
    case "spreadScore":
      return metrics?.spreadScore ?? null;
    case "volume24h":
      return metrics?.volume24h ?? null;
  }
}

function compareNullableNumbers(
  a: number | null,
  b: number | null,
  direction: SortDirection,
): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const delta = a - b;
  if (delta === 0) return 0;
  return direction === "asc" ? delta : -delta;
}

export function compareMarketItems(
  a: MarketItemRow,
  b: MarketItemRow,
  metricsByItemId: Map<number, ItemTradingMetrics>,
  sortKey: MarketSortKey,
  direction: SortDirection,
  locale: string,
): number {
  const aValue = sortValue(a, metricsByItemId.get(a.itemId), sortKey);
  const bValue = sortValue(b, metricsByItemId.get(b.itemId), sortKey);

  if (typeof aValue === "string" && typeof bValue === "string") {
    const result = aValue.localeCompare(bValue, locale, { sensitivity: "base" });
    if (result !== 0) return direction === "asc" ? result : -result;
    return a.itemId - b.itemId;
  }

  if (typeof aValue === "number" && typeof bValue === "number") {
    const delta = aValue - bValue;
    if (delta !== 0) return direction === "asc" ? delta : -delta;
    return a.itemId - b.itemId;
  }

  const aNumber = aValue === null ? null : Number(aValue);
  const bNumber = bValue === null ? null : Number(bValue);
  const result = compareNullableNumbers(aNumber, bNumber, direction);
  if (result !== 0) return result;
  return a.itemId - b.itemId;
}

export function sortMarketItems(
  items: MarketItemRow[],
  metricsByItemId: Map<number, ItemTradingMetrics>,
  sortKey: MarketSortKey,
  direction: SortDirection,
  locale: string,
): MarketItemRow[] {
  return [...items].sort((a, b) =>
    compareMarketItems(a, b, metricsByItemId, sortKey, direction, locale),
  );
}
