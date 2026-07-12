import type { MarketItemRow } from "../fetcher/types.ts";
import { translateNameId } from "../i18n/game-labels.ts";
import type { ResolvedItemPrices } from "./market-price-sanitize.ts";

export type MarketSortKey =
  | "itemId"
  | "itemName"
  | "bid"
  | "bidDelta"
  | "ask"
  | "askDelta"
  | "prevClose";

export type SortDirection = "asc" | "desc";

export type MarketTableColumn = "item" | "bid" | "ask" | "prevClose";

export const DEFAULT_MARKET_SORT: { key: MarketSortKey; direction: SortDirection } = {
  key: "itemId",
  direction: "asc",
};

export const COLUMN_SORT_SEQUENCE: Record<MarketTableColumn, MarketSortKey[]> = {
  item: ["itemId", "itemName"],
  bid: ["bid", "bidDelta"],
  ask: ["ask", "askDelta"],
  prevClose: ["prevClose"],
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
  resolved: ResolvedItemPrices | undefined,
  sortKey: MarketSortKey,
): number | string | null {
  switch (sortKey) {
    case "itemId":
      return item.itemId;
    case "itemName":
      return translateNameId(item.name_id);
    case "bid":
      return resolved?.bid ?? null;
    case "bidDelta":
      return resolved?.bidDelta ?? null;
    case "ask":
      return resolved?.ask ?? null;
    case "askDelta":
      return resolved?.askDelta ?? null;
    case "prevClose":
      return resolved?.prevClose ?? null;
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
  resolvedByItemId: Map<number, ResolvedItemPrices>,
  sortKey: MarketSortKey,
  direction: SortDirection,
  locale: string,
): number {
  const aValue = sortValue(a, resolvedByItemId.get(a.itemId), sortKey);
  const bValue = sortValue(b, resolvedByItemId.get(b.itemId), sortKey);

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
  resolvedByItemId: Map<number, ResolvedItemPrices>,
  sortKey: MarketSortKey,
  direction: SortDirection,
  locale: string,
): MarketItemRow[] {
  return [...items].sort((a, b) =>
    compareMarketItems(a, b, resolvedByItemId, sortKey, direction, locale),
  );
}
