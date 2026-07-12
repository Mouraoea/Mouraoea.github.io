import type { MarketSnapshot } from "../fetcher/types.ts";
import { compute24hChange } from "./market-price-change.ts";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function isValidMarketPrice(value: number | null | undefined): boolean {
  return value !== null && value !== undefined && value > 0;
}

export interface SanitizedHistoryPoint {
  date: string;
  time: number;
  bid: number | null;
  ask: number | null;
  prevClose: number | null;
  tradeVolume1Day: number | null;
}

export interface ResolvedItemPrices {
  bid: number | null;
  ask: number | null;
  prevClose: number | null;
  bidDelta: number | null;
  askDelta: number | null;
  hasAnyValidPrice: boolean;
}

function forwardFill(values: (number | null)[]): (number | null)[] {
  let lastValid: number | null = null;
  return values.map((value) => {
    if (isValidMarketPrice(value)) {
      lastValid = value;
      return value;
    }
    return lastValid;
  });
}

function priceMidpoint(bid: number | null, ask: number | null): number | null {
  const validBid = isValidMarketPrice(bid) ? bid : null;
  const validAsk = isValidMarketPrice(ask) ? ask : null;

  if (validBid !== null && validAsk !== null) {
    return (validBid + validAsk) / 2;
  }
  if (validBid !== null) return validBid;
  if (validAsk !== null) return validAsk;
  return null;
}

function findReferenceIndex(
  points: SanitizedHistoryPoint[],
  latestIndex: number,
  minGapMs: number,
): number | null {
  const latestTime = points[latestIndex].time;

  for (let index = latestIndex - 1; index >= 0; index -= 1) {
    if (latestTime - points[index].time >= minGapMs) {
      return index;
    }
  }

  return null;
}

export function buildSanitizedItemHistory(
  snapshots: MarketSnapshot[],
  itemId: number,
): SanitizedHistoryPoint[] {
  const rawPoints: {
    date: string;
    time: number;
    bid: number | null;
    ask: number | null;
    prevClose: number | null;
    tradeVolume1Day: number | null;
  }[] = [];

  for (const snapshot of snapshots) {
    const item = snapshot.items.find((row) => row.itemId === itemId);
    if (!item) continue;

    rawPoints.push({
      date: snapshot.date,
      time: Date.parse(snapshot.capturedAt),
      bid: isValidMarketPrice(item.highestBuyPrice) ? item.highestBuyPrice : null,
      ask: isValidMarketPrice(item.lowestSellPrice) ? item.lowestSellPrice : null,
      prevClose: isValidMarketPrice(item.history_1d) ? item.history_1d : null,
      tradeVolume1Day: item.tradeVolume1Day,
    });
  }

  const filledBids = forwardFill(rawPoints.map((point) => point.bid));
  const filledAsks = forwardFill(rawPoints.map((point) => point.ask));
  const filledPrevCloses = forwardFill(rawPoints.map((point) => point.prevClose));

  return rawPoints.map((point, index) => ({
    date: point.date,
    time: point.time,
    bid: filledBids[index],
    ask: filledAsks[index],
    prevClose: filledPrevCloses[index],
    tradeVolume1Day: point.tradeVolume1Day,
  }));
}

export function resolveLatestPrices(
  points: SanitizedHistoryPoint[],
): ResolvedItemPrices {
  const empty: ResolvedItemPrices = {
    bid: null,
    ask: null,
    prevClose: null,
    bidDelta: null,
    askDelta: null,
    hasAnyValidPrice: false,
  };

  if (points.length === 0) return empty;

  const latestIndex = points.length - 1;
  const latest = points[latestIndex];
  const referenceIndex = findReferenceIndex(points, latestIndex, MS_PER_DAY);
  const reference = referenceIndex !== null ? points[referenceIndex] : null;

  const prevClose =
    reference !== null
      ? priceMidpoint(reference.bid, reference.ask) ?? reference.prevClose
      : null;

  const bidDelta =
    latest.bid !== null && reference !== null && reference.bid !== null
      ? compute24hChange(latest.bid, reference.bid)
      : null;
  const askDelta =
    latest.ask !== null && reference !== null && reference.ask !== null
      ? compute24hChange(latest.ask, reference.ask)
      : null;

  return {
    bid: latest.bid,
    ask: latest.ask,
    prevClose,
    bidDelta,
    askDelta,
    hasAnyValidPrice: points.some(
      (point) => point.bid !== null || point.ask !== null || point.prevClose !== null,
    ),
  };
}

export function buildResolvedPricesMap(
  snapshots: MarketSnapshot[],
): Map<number, ResolvedItemPrices> {
  const itemIds = new Set<number>();

  for (const snapshot of snapshots) {
    for (const item of snapshot.items) {
      if (item.itemId !== -1) itemIds.add(item.itemId);
    }
  }

  const map = new Map<number, ResolvedItemPrices>();

  for (const itemId of itemIds) {
    const history = buildSanitizedItemHistory(snapshots, itemId);
    map.set(itemId, resolveLatestPrices(history));
  }

  return map;
}

export function toChartHistoryPoints(
  points: SanitizedHistoryPoint[],
): {
  date: string;
  time: number;
  highestBuyPrice: number;
  lowestSellPrice: number;
  history_1d: number | null;
  tradeVolume1Day: number | null;
}[] {
  return points
    .filter((point) => point.bid !== null || point.ask !== null)
    .map((point) => ({
      date: point.date,
      time: point.time,
      highestBuyPrice: point.bid ?? 0,
      lowestSellPrice: point.ask ?? 0,
      history_1d: point.prevClose,
      tradeVolume1Day: point.tradeVolume1Day,
    }));
}
