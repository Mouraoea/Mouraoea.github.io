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

/** Lookback window for prevClose oscillation detection. */
const FLUCTUATION_LOOKBACK_DAYS = 30;
/** Need enough daily closes to observe multi-day up/down cycles. */
const MIN_FLUCTUATION_DAYS = 8;
/** At least two half-swings (one full up+down cycle). */
const MIN_FLUCTUATION_SWINGS = 2;
/**
 * Path-vs-displacement ratio: 0 = pure trend, 1 = pure oscillation.
 * Require enough back-and-forth so trending moves are not scored.
 */
const MIN_OSCILLATION_QUALITY = 0.35;
/** Ignore tiny noise swings below this fraction of mean close. */
const MIN_RELATIVE_AMPLITUDE = 0.01;

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
  /**
   * Historic prevClose oscillation opportunity: mean swing amplitude × volume,
   * expressed as expected gain per day (volume × amplitude / cycleDays).
   */
  fluctuationScore: number | null;
  /** Mean peak-to-trough prevClose move over detected swings. */
  fluctuationAmplitude: number | null;
  /** Mean full up+down cycle length in days. */
  fluctuationCycleDays: number | null;
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

interface DailyPrevClose {
  date: string;
  close: number;
}

/** One prevClose (history_1d) reading per UTC date, latest snapshot wins. */
export function extractDailyPrevCloses(
  snapshots: MarketSnapshot[],
  itemId: number,
  lookbackDays = FLUCTUATION_LOOKBACK_DAYS,
): DailyPrevClose[] {
  if (snapshots.length === 0) return [];

  const latestTime = Date.parse(snapshots[snapshots.length - 1].capturedAt);
  const windowStart = latestTime - lookbackDays * MS_PER_DAY;
  const closeByDate = new Map<string, { time: number; close: number }>();

  for (const snapshot of snapshots) {
    const time = Date.parse(snapshot.capturedAt);
    if (time < windowStart) continue;

    const item = snapshot.items.find((row) => row.itemId === itemId);
    if (!item || !isValidMarketPrice(item.history_1d)) continue;

    const existing = closeByDate.get(snapshot.date);
    if (!existing || time >= existing.time) {
      closeByDate.set(snapshot.date, {
        time,
        close: item.history_1d as number,
      });
    }
  }

  return [...closeByDate.entries()]
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, { close }]) => ({ date, close }));
}

/**
 * Indices of turning points in a price series (local peaks/troughs),
 * including the first and last samples.
 */
function findExtremaIndices(values: number[]): number[] {
  if (values.length < 2) return values.length === 1 ? [0] : [];

  const extrema: number[] = [0];
  let direction = 0;

  for (let i = 1; i < values.length; i += 1) {
    const sign = Math.sign(values[i] - values[i - 1]);
    if (sign === 0) continue;

    if (direction === 0) {
      direction = sign;
      continue;
    }

    if (sign !== direction) {
      extrema.push(i - 1);
      direction = sign;
    }
  }

  const last = values.length - 1;
  if (extrema[extrema.length - 1] !== last) {
    extrema.push(last);
  }

  return extrema;
}

export interface FluctuationMetrics {
  amplitude: number;
  cycleDays: number;
  /** Expected gold opportunity per day: volume × amplitude / cycleDays. */
  score: number;
}

/**
 * Scores consistent multi-day prevClose oscillation × average volume.
 *
 * Example: closes oscillating 150↔200 on a 4-day cycle with 120k mean volume
 * → amplitude 50, cycleDays 4, score = 120000 * 50 / 4.
 */
export function computeFluctuationMetrics(
  snapshots: MarketSnapshot[],
  itemId: number,
  volume7dAvg: number | null,
  isLiquid: boolean,
): FluctuationMetrics | null {
  if (!isLiquid || volume7dAvg === null || volume7dAvg <= 0) return null;

  const daily = extractDailyPrevCloses(snapshots, itemId);
  if (daily.length < MIN_FLUCTUATION_DAYS) return null;

  const closes = daily.map((point) => point.close);
  let pathLength = 0;
  for (let i = 1; i < closes.length; i += 1) {
    pathLength += Math.abs(closes[i] - closes[i - 1]);
  }
  if (pathLength <= 0) return null;

  const netMove = Math.abs(closes[closes.length - 1] - closes[0]);
  const oscillationQuality = 1 - netMove / pathLength;
  if (oscillationQuality < MIN_OSCILLATION_QUALITY) return null;

  const extrema = findExtremaIndices(closes);
  if (extrema.length < MIN_FLUCTUATION_SWINGS + 1) return null;

  const swings: { amplitude: number; days: number }[] = [];
  for (let i = 1; i < extrema.length; i += 1) {
    const from = extrema[i - 1];
    const to = extrema[i];
    const amplitude = Math.abs(closes[to] - closes[from]);
    const days = Math.max(
      1,
      Math.round(
        (Date.parse(`${daily[to].date}T00:00:00Z`) -
          Date.parse(`${daily[from].date}T00:00:00Z`)) /
          MS_PER_DAY,
      ),
    );
    if (amplitude > 0) {
      swings.push({ amplitude, days });
    }
  }

  if (swings.length < MIN_FLUCTUATION_SWINGS) return null;

  const meanAmplitude =
    swings.reduce((sum, swing) => sum + swing.amplitude, 0) / swings.length;
  const meanHalfCycleDays =
    swings.reduce((sum, swing) => sum + swing.days, 0) / swings.length;
  const cycleDays = meanHalfCycleDays * 2;

  const meanClose =
    closes.reduce((sum, value) => sum + value, 0) / closes.length;
  if (meanClose <= 0 || meanAmplitude / meanClose < MIN_RELATIVE_AMPLITUDE) {
    return null;
  }

  if (cycleDays <= 0) return null;

  return {
    amplitude: meanAmplitude,
    cycleDays,
    score: (volume7dAvg * meanAmplitude) / cycleDays,
  };
}

export function computeTradingMetrics(
  item: MarketItemRow,
  resolved: ResolvedItemPrices,
  volume7dAvg: number | null,
  fluctuation: FluctuationMetrics | null = null,
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
    fluctuationScore: fluctuation?.score ?? null,
    fluctuationAmplitude: fluctuation?.amplitude ?? null,
    fluctuationCycleDays: fluctuation?.cycleDays ?? null,
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
    const volume7dAvg = computeVolume7dAverage(snapshots, item.itemId);
    const isLiquid =
      resolved.hasAnyValidPrice &&
      isValidMarketPrice(resolved.bid) &&
      isValidMarketPrice(resolved.ask) &&
      volume7dAvg !== null &&
      volume7dAvg >= MIN_LIQUID_VOLUME_7D_AVG;
    const fluctuation = computeFluctuationMetrics(
      snapshots,
      item.itemId,
      volume7dAvg,
      isLiquid,
    );
    map.set(
      item.itemId,
      computeTradingMetrics(item, resolved, volume7dAvg, fluctuation),
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

export type OpportunityStrategy = "upside" | "spread" | "fluctuation";

export function opportunityScore(
  metrics: ItemTradingMetrics,
  strategy: OpportunityStrategy,
): number | null {
  if (!metrics.isLiquid) return null;
  if (strategy === "upside") return metrics.upsideScore;
  if (strategy === "spread") return metrics.spreadScore;
  return metrics.fluctuationScore;
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
