import { useEffect, useRef } from "react";
import {
  ColorType,
  createChart,
  HistogramSeries,
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type LogicalRange,
  type UTCTimestamp,
} from "lightweight-charts";
import type { ItemHistoryPoint } from "../lib/market-item-history.ts";

interface MarketPriceChartLabels {
  bid: string;
  ask: string;
  prevClose: string;
}

interface MarketPriceChartProps {
  points: ItemHistoryPoint[];
  locale: string;
  labels: MarketPriceChartLabels;
  /** Reset fit/zoom when this changes (e.g. selected item id). */
  resetKey?: string | number;
  canLoadOlder?: boolean;
  loadingOlder?: boolean;
  onNeedOlderHistory?: () => void;
}

interface ChartSeries {
  bid: ISeriesApi<"Line">;
  ask: ISeriesApi<"Line">;
  close: ISeriesApi<"Line">;
  volume: ISeriesApi<"Histogram">;
}

function readCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function formatPrice(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

function toChartTime(timeMs: number): UTCTimestamp {
  return (timeMs / 1000) as UTCTimestamp;
}

function bidData(points: ItemHistoryPoint[]) {
  return points
    .filter((point) => point.highestBuyPrice > 0)
    .map((point) => ({
      time: toChartTime(point.time),
      value: point.highestBuyPrice,
    }));
}

function askData(points: ItemHistoryPoint[]) {
  return points
    .filter((point) => point.lowestSellPrice > 0)
    .map((point) => ({
      time: toChartTime(point.time),
      value: point.lowestSellPrice,
    }));
}

function closeData(points: ItemHistoryPoint[]) {
  return points
    .filter((point) => point.history_1d !== null && point.history_1d > 0)
    .map((point) => ({
      time: toChartTime(point.time),
      value: point.history_1d as number,
    }));
}

function volumeData(points: ItemHistoryPoint[], bidColor: string, askColor: string) {
  return points.map((point, index) => {
    const prevAsk = index > 0 ? points[index - 1].lowestSellPrice : point.lowestSellPrice;
    const up = point.lowestSellPrice >= prevAsk;
    return {
      time: toChartTime(point.time),
      value: point.tradeVolume1Day ?? 0,
      color: up ? bidColor : askColor,
    };
  });
}

const LEFT_EDGE_LOGICAL_THRESHOLD = 2;

export function MarketPriceChart({
  points,
  locale,
  labels,
  resetKey,
  canLoadOlder = false,
  loadingOlder = false,
  onNeedOlderHistory,
}: MarketPriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ChartSeries | null>(null);
  const fittedRef = useRef(false);
  const skipRangeEventRef = useRef(false);
  const pointsRef = useRef(points);
  const canLoadOlderRef = useRef(canLoadOlder);
  const loadingOlderRef = useRef(loadingOlder);
  const onNeedOlderHistoryRef = useRef(onNeedOlderHistory);

  pointsRef.current = points;
  canLoadOlderRef.current = canLoadOlder;
  loadingOlderRef.current = loadingOlder;
  onNeedOlderHistoryRef.current = onNeedOlderHistory;

  useEffect(() => {
    fittedRef.current = false;
  }, [resetKey]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const textColor = readCssVar("--color-text-muted");
    const borderColor = readCssVar("--color-border-subtle");
    const backgroundColor = readCssVar("--color-surface");
    const bidColor = readCssVar("--color-positive");
    const askColor = readCssVar("--color-negative");
    const closeColor = readCssVar("--color-primary");

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: backgroundColor },
        textColor,
        fontFamily: readCssVar("--font-sans"),
      },
      grid: {
        vertLines: { color: borderColor },
        horzLines: { color: borderColor },
      },
      rightPriceScale: {
        borderColor,
      },
      timeScale: {
        borderColor,
        timeVisible: true,
        secondsVisible: false,
      },
      localization: {
        locale,
        priceFormatter: (price: number) => formatPrice(price, locale),
      },
    });

    chartRef.current = chart;

    const bid = chart.addSeries(
      LineSeries,
      {
        color: bidColor,
        lineWidth: 2,
        title: labels.bid,
        priceLineVisible: false,
        lastValueVisible: true,
      },
      0,
    );

    const ask = chart.addSeries(
      LineSeries,
      {
        color: askColor,
        lineWidth: 2,
        title: labels.ask,
        priceLineVisible: false,
        lastValueVisible: true,
      },
      0,
    );

    const close = chart.addSeries(
      LineSeries,
      {
        color: closeColor,
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        title: labels.prevClose,
        priceLineVisible: false,
        lastValueVisible: true,
      },
      0,
    );

    const volume = chart.addSeries(
      HistogramSeries,
      {
        priceFormat: { type: "volume" },
        priceLineVisible: false,
        lastValueVisible: false,
      },
      1,
    );

    chart.panes()[1]?.setHeight(100);
    seriesRef.current = { bid, ask, close, volume };

    const initialPoints = pointsRef.current;
    if (initialPoints.length >= 2) {
      bid.setData(bidData(initialPoints));
      ask.setData(askData(initialPoints));
      close.setData(closeData(initialPoints));
      volume.setData(volumeData(initialPoints, bidColor, askColor));
      skipRangeEventRef.current = true;
      chart.timeScale().fitContent();
      fittedRef.current = true;
    }

    const handleVisibleRange = (range: LogicalRange | null) => {
      if (skipRangeEventRef.current) {
        skipRangeEventRef.current = false;
        return;
      }
      if (!range) return;
      if (!canLoadOlderRef.current || loadingOlderRef.current) return;
      if (range.from > LEFT_EDGE_LOGICAL_THRESHOLD) return;
      onNeedOlderHistoryRef.current?.();
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRange);

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleThemeChange = () => {
      chart.applyOptions({
        layout: {
          background: { type: ColorType.Solid, color: readCssVar("--color-surface") },
          textColor: readCssVar("--color-text-muted"),
        },
        grid: {
          vertLines: { color: readCssVar("--color-border-subtle") },
          horzLines: { color: readCssVar("--color-border-subtle") },
        },
        rightPriceScale: { borderColor: readCssVar("--color-border-subtle") },
        timeScale: { borderColor: readCssVar("--color-border-subtle") },
      });
      bid.applyOptions({ color: readCssVar("--color-positive") });
      ask.applyOptions({ color: readCssVar("--color-negative") });
      close.applyOptions({ color: readCssVar("--color-primary") });
    };

    mediaQuery.addEventListener("change", handleThemeChange);

    return () => {
      mediaQuery.removeEventListener("change", handleThemeChange);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRange);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      fittedRef.current = false;
    };
  }, [labels.ask, labels.bid, labels.prevClose, locale]);

  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series || points.length < 2) return;

    const bidColor = readCssVar("--color-positive");
    const askColor = readCssVar("--color-negative");
    const visibleRange = fittedRef.current
      ? chart.timeScale().getVisibleRange()
      : null;

    series.bid.setData(bidData(points));
    series.ask.setData(askData(points));
    series.close.setData(closeData(points));
    series.volume.setData(volumeData(points, bidColor, askColor));

    if (!fittedRef.current) {
      skipRangeEventRef.current = true;
      chart.timeScale().fitContent();
      fittedRef.current = true;
      return;
    }

    if (visibleRange) {
      skipRangeEventRef.current = true;
      chart.timeScale().setVisibleRange(visibleRange);
    }
  }, [points]);

  return <div ref={containerRef} className="market-price-chart" />;
}
