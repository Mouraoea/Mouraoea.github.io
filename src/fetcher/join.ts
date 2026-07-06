import { MARKET_HISTORY_PERIODS } from "./config.ts";
import { fetchMarketHistoryByPeriod } from "./api/history.ts";
import { fetchItemMap } from "./api/items.ts";
import { fetchMarket } from "./api/market.ts";
import type { MarketItemRow } from "./types.ts";

const HISTORY_FETCH_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseItemId(value: number | string | undefined): number {
  if (typeof value === "number") return value;
  const parsed = parseInt(String(value), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function historyValue(
  map: Record<number, number | null>,
  id: number,
): number | null {
  return map[id] !== undefined ? map[id] : null;
}

export async function getJoinedMarketData(): Promise<MarketItemRow[]> {
  const [market, idToName] = await Promise.all([
    fetchMarket(),
    fetchItemMap(),
  ]);

  const historyMaps: Record<number, number | null>[] = [];
  for (const period of MARKET_HISTORY_PERIODS) {
    historyMaps.push(await fetchMarketHistoryByPeriod(period));
    await sleep(HISTORY_FETCH_DELAY_MS);
  }

  const [history1d, history7d, history30d, history1y] = historyMaps;

  const joined = market.map((item) => {
    const id = parseItemId(item.itemId);
    return {
      itemId: id,
      name_id: idToName[id] || "",
      lowestSellPrice: item.lowestSellPrice,
      lowestPriceVolume: item.lowestPriceVolume,
      highestBuyPrice: item.highestBuyPrice,
      highestPriceVolume: item.highestPriceVolume,
      history_1d: historyValue(history1d, id),
      history_7d: historyValue(history7d, id),
      history_30d: historyValue(history30d, id),
      history_1y: historyValue(history1y, id),
      tradeVolume1Day:
        item.tradeVolume1Day !== undefined ? item.tradeVolume1Day : null,
    };
  });

  joined.sort((a, b) => (a.itemId || 0) - (b.itemId || 0));
  return joined;
}
