import { MARKET_HISTORY_API_URL, type MarketHistoryPeriod } from "../config.ts";
import { normalizeHistoryResponse } from "./normalize.ts";
import { fetchJsonWithRetry } from "./http.ts";

export async function fetchMarketHistoryByPeriod(
  period: MarketHistoryPeriod,
): Promise<Record<number, number | null>> {
  const url = `${MARKET_HISTORY_API_URL}?period=${encodeURIComponent(period)}`;
  const data = await fetchJsonWithRetry(url, `Market History (period ${period})`);
  return normalizeHistoryResponse(data);
}
