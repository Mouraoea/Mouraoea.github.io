import {
  buildMarketHeaders,
  MARKET_HISTORY_API_URL,
  type MarketHistoryPeriod,
} from "../config.ts";
import { normalizeHistoryResponse } from "./normalize.ts";

const MAX_RETRIES = 6;
const RETRY_BASE_MS = 3000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchMarketHistoryByPeriod(
  period: MarketHistoryPeriod,
): Promise<Record<number, number | null>> {
  const url = `${MARKET_HISTORY_API_URL}?period=${encodeURIComponent(period)}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, {
      method: "GET",
      headers: buildMarketHeaders(),
    });

    if (response.status === 429 && attempt < MAX_RETRIES) {
      await sleep(RETRY_BASE_MS * (attempt + 1));
      continue;
    }

    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        `Market History HTTP Error ${response.status} (period ${period})`,
      );
    }

    const data: unknown = await response.json();
    return normalizeHistoryResponse(data);
  }

  throw new Error(`Market History HTTP Error 429 (period ${period})`);
}
