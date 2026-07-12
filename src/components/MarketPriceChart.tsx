import { useEffect, useRef } from "react";
import {
  ColorType,
  createChart,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { ItemHistoryPoint } from "../lib/market-item-history.ts";

interface MarketPriceChartProps {
  points: ItemHistoryPoint[];
  locale: string;
}

function readCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function formatPrice(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

function toChartTime(date: string): UTCTimestamp {
  return (Date.parse(`${date}T00:00:00.000Z`) / 1000) as UTCTimestamp;
}

export function MarketPriceChart({ points, locale }: MarketPriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || points.length < 2) return;

    const textColor = readCssVar("--color-text-muted");
    const borderColor = readCssVar("--color-border-subtle");
    const backgroundColor = readCssVar("--color-surface");
    const bidColor = readCssVar("--color-positive");
    const askColor = readCssVar("--color-negative");

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

    const bidSeries = chart.addSeries(
      LineSeries,
      {
        color: bidColor,
        lineWidth: 2,
        title: "Bid",
        priceLineVisible: false,
        lastValueVisible: true,
      },
      0,
    );

    const askSeries = chart.addSeries(
      LineSeries,
      {
        color: askColor,
        lineWidth: 2,
        title: "Ask",
        priceLineVisible: false,
        lastValueVisible: true,
      },
      0,
    );

    const volumeSeries = chart.addSeries(
      HistogramSeries,
      {
        priceFormat: { type: "volume" },
        priceLineVisible: false,
        lastValueVisible: false,
      },
      1,
    );

    chart.panes()[1]?.setHeight(100);

    bidSeries.setData(
      points.map((point) => ({
        time: toChartTime(point.date),
        value: point.highestBuyPrice,
      })),
    );

    askSeries.setData(
      points.map((point) => ({
        time: toChartTime(point.date),
        value: point.lowestSellPrice,
      })),
    );

    volumeSeries.setData(
      points.map((point, index) => {
        const prevAsk = index > 0 ? points[index - 1].lowestSellPrice : point.lowestSellPrice;
        const up = point.lowestSellPrice >= prevAsk;
        return {
          time: toChartTime(point.date),
          value: point.tradeVolume1Day ?? 0,
          color: up ? bidColor : askColor,
        };
      }),
    );

    chart.timeScale().fitContent();

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
      bidSeries.applyOptions({ color: readCssVar("--color-positive") });
      askSeries.applyOptions({ color: readCssVar("--color-negative") });
    };

    mediaQuery.addEventListener("change", handleThemeChange);

    return () => {
      mediaQuery.removeEventListener("change", handleThemeChange);
      chart.remove();
      chartRef.current = null;
    };
  }, [locale, points]);

  return <div ref={containerRef} className="market-price-chart" />;
}
