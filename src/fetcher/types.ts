export interface MarketItemRow {
  itemId: number;
  name_id: string;
  lowestSellPrice: number;
  lowestPriceVolume: number;
  highestBuyPrice: number;
  highestPriceVolume: number;
  history_1d: number | null;
  history_7d: number | null;
  history_30d: number | null;
  history_1y: number | null;
  tradeVolume1Day: number | null;
}

export interface MarketSnapshot {
  date: string;
  capturedAt: string;
  items: MarketItemRow[];
}

export interface MonthlyArchive {
  version: 1;
  month: string;
  snapshots: MarketSnapshot[];
}

export interface MarketApiItem {
  itemId: number;
  lowestSellPrice: number;
  lowestPriceVolume: number;
  highestBuyPrice: number;
  highestPriceVolume: number;
  tradeVolume1Day?: number;
}

export interface ItemCatalogEntry {
  name_id: string;
  internal_id: number | string;
}

export const GOLD_ROW: MarketItemRow = {
  itemId: -1,
  name_id: "gold",
  lowestSellPrice: 1,
  lowestPriceVolume: 1,
  highestBuyPrice: 1,
  highestPriceVolume: 1,
  history_1d: 1,
  history_7d: 1,
  history_30d: 1,
  history_1y: 1,
  tradeVolume1Day: 9_999_999_999,
};
