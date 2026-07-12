export type PriceChangeDirection = "up" | "down" | "flat";

export function compute24hChange(
  current: number,
  prevClose: number | null,
): number | null {
  if (prevClose === null || prevClose <= 0) return null;
  return (current - prevClose) / prevClose;
}

export function priceChangeDirection(change: number | null): PriceChangeDirection {
  if (change === null) return "flat";
  if (change > 0) return "up";
  if (change < 0) return "down";
  return "flat";
}

export function formatPercentChange(change: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(change);
}

export function changeChevron(direction: PriceChangeDirection): string {
  switch (direction) {
    case "up":
      return "▲";
    case "down":
      return "▼";
    case "flat":
      return "—";
  }
}
