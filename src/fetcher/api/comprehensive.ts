import {
  MARKET_COMPREHENSIVE_BASE_URL,
  COMPREHENSIVE_FETCH_DELAY_MS,
} from "../config.ts";
import { fetchJsonWithRetry, sleep } from "./http.ts";

export interface ComprehensiveMarketDetails {
  itemId: number;
  tradeVolume1Day?: number;
}

export async function fetchComprehensiveItem(
  itemId: number,
): Promise<ComprehensiveMarketDetails | null> {
  const url = `${MARKET_COMPREHENSIVE_BASE_URL}/${itemId}`;
  const data = (await fetchJsonWithRetry(
    url,
    `Comprehensive item ${itemId}`,
  )) as ComprehensiveMarketDetails;

  if (!data || typeof data !== "object") return null;
  return data;
}

export function extractTradeVolume1Day(
  details: ComprehensiveMarketDetails | null,
): number | null {
  if (!details || details.tradeVolume1Day === undefined) return null;
  return details.tradeVolume1Day;
}

export async function fetchTradeVolumesForItems(
  itemIds: number[],
): Promise<Record<number, number | null>> {
  const volumes: Record<number, number | null> = {};
  const total = itemIds.length;

  for (let i = 0; i < total; i++) {
    const itemId = itemIds[i];
    try {
      const details = await fetchComprehensiveItem(itemId);
      volumes[itemId] = extractTradeVolume1Day(details);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Skipping trade volume for item ${itemId}: ${message}`);
      volumes[itemId] = null;
    }

    if ((i + 1) % 50 === 0 || i === total - 1) {
      console.log(`Trade volumes: ${i + 1}/${total}`);
    }

    if (i < total - 1) {
      await sleep(COMPREHENSIVE_FETCH_DELAY_MS);
    }
  }

  return volumes;
}
