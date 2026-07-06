import { buildMarketHeaders, MARKET_API_URL } from "../config.ts";
import type { MarketApiItem } from "../types.ts";

export async function fetchMarket(): Promise<MarketApiItem[]> {
  const response = await fetch(MARKET_API_URL, {
    method: "GET",
    headers: buildMarketHeaders(),
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Market HTTP Error ${response.status}`);
  }

  const data: unknown = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Market API returned unexpected format");
  }

  return data as MarketApiItem[];
}
