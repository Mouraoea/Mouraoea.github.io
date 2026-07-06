export const MARKET_API_URL =
  "https://query.idleclans.com/api/PlayerMarket/items/prices/latest";

export const MARKET_HISTORY_API_URL =
  "https://query.idleclans.com/api/PlayerMarket/items/prices/history";

export const ITEMS_API_URL = "https://idleclans.uraxys.dev/api/items/all";

export const MARKET_HISTORY_PERIODS = ["1d", "7d", "30d", "1y"] as const;

export type MarketHistoryPeriod = (typeof MARKET_HISTORY_PERIODS)[number];

export function getMarketApiKey(): string {
  const viteKey = import.meta.env?.VITE_MARKET_API_KEY;
  if (typeof viteKey === "string" && viteKey.length > 0) {
    return viteKey;
  }
  if (typeof process !== "undefined" && process.env?.MARKET_API_KEY) {
    return process.env.MARKET_API_KEY;
  }
  return "";
}

export function buildMarketHeaders(): HeadersInit {
  const apiKey = getMarketApiKey();
  if (apiKey) {
    return {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    };
  }
  return { Accept: "application/json" };
}
