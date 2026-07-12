import type { MarketItemRow, MarketSnapshot } from "../fetcher/types.ts";
import { compute24hChange } from "./market-price-change.ts";
import {
  buildResolvedPricesMap,
  isValidMarketPrice,
  type ResolvedItemPrices,
} from "./market-price-sanitize.ts";

/** Minimum 7d average trade volume required for the liquid-only filter and scoring. */
export const MIN_LIQUID_VOLUME_7D_AVG = 100;

const VOLUME_AVG_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface ItemTradingMetrics extends ResolvedItemPrices {
  mid: number | null;
  spread: number | null;
  spreadPercent: number | null;
  vs7d: number | null;
  vs30d: number | null;
  volume24h: number | null;
  volume7dAvg: number | null;
  isLiquid: boolean;
  /** Buy-below-fair-value swing: depressed vs 7d avg with net edge after spread. */
  upsideScore: number | null;
  /** Patient two-sided trading: wide spread on a liquid, deep book. */
  spreadScore: number | null;
}

/** Extra margin required above spread % before an upside swing is considered viable. */
const UPSIDE_SPREAD_BUFFER = 0.02;

function priceMidpoint(bid: number | null, ask: number | null): number | null {
  if (isValidMarketPrice(bid) && isValidMarketPrice(ask)) {
    return ((bid as number) + (ask as number)) / 2;
  }
  if (isValidMarketPrice(bid)) return bid;
  if (isValidMarketPrice(ask)) return ask;
  return null;
}

function marketTurnoverWeight(
  volume7dAvg: number | null,
  mid: number | null,
): number {
  if (volume7dAvg === null || volume7dAvg <= 0) return 0;
  if (mid === null || mid <= 0) return 0;
  return Math.log10(volume7dAvg * mid + 1);
}

/** Mean daily tradeVolume1Day over the last 7 UTC days (one reading per day). */
export function computeVolume7dAverage(
  snapshots: MarketSnapshot[],
  itemId: number,
): number | null {
  if (snapshots.length === 0) return null;

  const latestTime = Date.parse(snapshots[snapshots.length - 1].capturedAt);
  const windowStart = latestTime - VOLUME_AVG_DAYS * MS_PER_DAY;
  const volumeByDate = new Map<string, { time: number; volume: number }>();

  for (const snapshot of snapshots) {
    const time = Date.parse(snapshot.capturedAt);
    if (time < windowStart) continue;

    const item = snapshot.items.find((row) => row.itemId === itemId);
    if (!item) continue;

    const volume = item.tradeVolume1Day;
    if (volume === null || volume < 0) continue;

    const existing = volumeByDate.get(snapshot.date);
    if (!existing || time >= existing.time) {
      volumeByDate.set(snapshot.date, { time, volume });
    }
  }

  if (volumeByDate.size === 0) return null;

  let sum = 0;
  for (const { volume } of volumeByDate.values()) {
    sum += volume;
  }
  return sum / volumeByDate.size;
}

function bookDepthWeight(item: MarketItemRow): number {
  const bidDepth = item.highestPriceVolume > 0 ? item.highestPriceVolume : 0;
  const askDepth = item.lowestPriceVolume > 0 ? item.lowestPriceVolume : 0;
  const depth = Math.min(bidDepth, askDepth);
  if (depth <= 0) return 0;
  return Math.log10(depth + 1);
}

/** Expected reversion move minus spread and safety buffer; null when edge is not positive. */
function netUpsideEdge(
  expectedMove: number | null,
  spreadPercent: number | null,
): number | null {
  if (expectedMove === null || expectedMove <= 0) return null;
  const spread = spreadPercent ?? 0;
  const net = expectedMove - spread - UPSIDE_SPREAD_BUFFER;
  return net > 0 ? net : null;
}

function computeUpsideScore(
  vs7d: number | null,
  vs30d: number | null,
  spreadPercent: number | null,
  volume7dAvg: number | null,
  mid: number | null,
  isLiquid: boolean,
): number | null {
  if (!isLiquid || vs7d === null || vs7d >= 0) return null;

  const expectedMove = -vs7d;
  const netEdge = netUpsideEdge(expectedMove, spreadPercent);
  if (netEdge === null) return null;

  const weight = marketTurnoverWeight(volume7dAvg, mid);
  if (weight <= 0) return null;

  let score = netEdge * weight;

  if (vs30d !== null && vs30d > 0) {
    score *= Math.max(0, 1 - vs30d);
    if (score <= 0) return null;
  }

  return score;
}

function computeSpreadScore(
  spreadPercent: number | null,
  volume7dAvg: number | null,
  mid: number | null,
  depthWeight: number,
  isLiquid: boolean,
): number | null {
  if (!isLiquid || spreadPercent === null || spreadPercent <= 0) return null;

  const turnoverWeight = marketTurnoverWeight(volume7dAvg, mid);
  if (turnoverWeight <= 0 || depthWeight <= 0) return null;

  return spreadPercent * turnoverWeight * depthWeight;
}

export function computeTradingMetrics(
  item: MarketItemRow,
  resolved: ResolvedItemPrices,
  volume7dAvg: number | null,
): ItemTradingMetrics {
  const bid = resolved.bid;
  const ask = resolved.ask;
  const mid = priceMidpoint(bid, ask);
  const spread =
    isValidMarketPrice(bid) && isValidMarketPrice(ask)
      ? (ask as number) - (bid as number)
      : null;
  const spreadPercent =
    spread !== null && mid !== null && mid > 0 ? spread / mid : null;

  const vs7d =
    mid !== null && isValidMarketPrice(item.history_7d)
      ? compute24hChange(mid, item.history_7d)
      : null;

  const vs30d =
    mid !== null && isValidMarketPrice(item.history_30d)
      ? compute24hChange(mid, item.history_30d)
      : null;

  const volume24h = item.tradeVolume1Day;
  const isLiquid =
    resolved.hasAnyValidPrice &&
    isValidMarketPrice(bid) &&
    isValidMarketPrice(ask) &&
    volume7dAvg !== null &&
    volume7dAvg >= MIN_LIQUID_VOLUME_7D_AVG;

  const upsideScore = computeUpsideScore(
    vs7d,
    vs30d,
    spreadPercent,
    volume7dAvg,
    mid,
    isLiquid,
  );
  const spreadScore = computeSpreadScore(
    spreadPercent,
    volume7dAvg,
    mid,
    bookDepthWeight(item),
    isLiquid,
  );

  return {
    ...resolved,
    mid,
    spread,
    spreadPercent,
    vs7d,
    vs30d,
    volume24h,
    volume7dAvg,
    isLiquid,
    upsideScore,
    spreadScore,
  };
}

export function buildTradingMetricsMap(
  snapshots: MarketSnapshot[],
  latestSnapshot: MarketSnapshot,
): Map<number, ItemTradingMetrics> {
  const resolvedMap = buildResolvedPricesMap(snapshots);
  const map = new Map<number, ItemTradingMetrics>();

  for (const item of latestSnapshot.items) {
    if (item.itemId === -1) continue;
    const resolved = resolvedMap.get(item.itemId) ?? {
      bid: null,
      ask: null,
      prevClose: null,
      bidDelta: null,
      askDelta: null,
      hasAnyValidPrice: false,
    };
    map.set(
      item.itemId,
      computeTradingMetrics(
        item,
        resolved,
        computeVolume7dAverage(snapshots, item.itemId),
      ),
    );
  }

  return map;
}

export function buildSanitizedPriceMap(
  snapshot: MarketSnapshot,
  snapshots: MarketSnapshot[],
): Map<string, MarketItemRow> {
  const metricsMap = buildTradingMetricsMap(snapshots, snapshot);
  const map = new Map<string, MarketItemRow>();

  for (const item of snapshot.items) {
    const metrics = metricsMap.get(item.itemId);
    if (!metrics?.hasAnyValidPrice) {
      map.set(item.name_id, item);
      continue;
    }

    map.set(item.name_id, {
      ...item,
      highestBuyPrice: metrics.bid ?? item.highestBuyPrice,
      lowestSellPrice: metrics.ask ?? item.lowestSellPrice,
      history_1d:
        metrics.prevClose !== null ? metrics.prevClose : item.history_1d,
    });
  }

  return map;
}

export type OpportunityStrategy = "upside" | "spread";

export function opportunityScore(
  metrics: ItemTradingMetrics,
  strategy: OpportunityStrategy,
): number | null {
  if (!metrics.isLiquid) return null;
  if (strategy === "upside") return metrics.upsideScore;
  return metrics.spreadScore;
}

export function rankOpportunities(
  items: MarketItemRow[],
  metricsMap: Map<number, ItemTradingMetrics>,
  strategy: OpportunityStrategy,
  liquidOnly: boolean,
): MarketItemRow[] {
  return [...items]
    .filter((item) => {
      const metrics = metricsMap.get(item.itemId);
      if (!metrics) return false;
      if (liquidOnly && !metrics.isLiquid) return false;
      return opportunityScore(metrics, strategy) !== null;
    })
    .sort((a, b) => {
      const aScore = opportunityScore(metricsMap.get(a.itemId)!, strategy) ?? 0;
      const bScore = opportunityScore(metricsMap.get(b.itemId)!, strategy) ?? 0;
      if (bScore !== aScore) return bScore - aScore;
      return a.itemId - b.itemId;
    });
}
