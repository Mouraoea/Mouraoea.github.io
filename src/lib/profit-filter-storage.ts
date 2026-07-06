import type { TradePolicy } from "./market-prices.ts";
import { TRADE_POLICY_OPTIONS } from "./market-prices.ts";

export const PROFIT_FILTER_SETTINGS_VERSION = 1 as const;

const STORAGE_KEY = "idleclans-profit-filter-settings";

const VALID_TRADE_POLICIES = new Set<TradePolicy>(
  TRADE_POLICY_OPTIONS.map((option) => option.value),
);

export interface MaxMarketCapacityRatioFilter {
  enabled: boolean;
  value: number;
}

export interface ProfitFilterSettings {
  version: typeof PROFIT_FILTER_SETTINGS_VERSION;
  selectedDate: string;
  buyPolicy: TradePolicy;
  sellPolicy: TradePolicy;
  includeInstantActions: boolean;
  maxMarketCapacityRatioFilter: MaxMarketCapacityRatioFilter;
  search: string;
}

export function createDefaultProfitFilterSettings(): ProfitFilterSettings {
  return {
    version: PROFIT_FILTER_SETTINGS_VERSION,
    selectedDate: "",
    buyPolicy: "fast_trade",
    sellPolicy: "fast_trade",
    includeInstantActions: true,
    maxMarketCapacityRatioFilter: { enabled: false, value: 0.1 },
    search: "",
  };
}

function isTradePolicy(value: unknown): value is TradePolicy {
  return typeof value === "string" && VALID_TRADE_POLICIES.has(value as TradePolicy);
}

function legacyInstantToPolicy(instant: boolean, side: "buy" | "sell"): TradePolicy {
  if (side === "buy") {
    return instant ? "fast_trade" : "highest_profit";
  }
  return instant ? "fast_trade" : "highest_profit";
}

function parseBuyPolicy(record: Record<string, unknown>): TradePolicy {
  if (isTradePolicy(record.buyPolicy)) return record.buyPolicy;
  if (isTradePolicy(record.tradePolicy)) return record.tradePolicy;

  if (typeof record.instantBuy === "boolean") {
    return legacyInstantToPolicy(record.instantBuy, "buy");
  }

  return createDefaultProfitFilterSettings().buyPolicy;
}

function parseSellPolicy(record: Record<string, unknown>): TradePolicy {
  if (isTradePolicy(record.sellPolicy)) return record.sellPolicy;
  if (isTradePolicy(record.tradePolicy)) return record.tradePolicy;

  if (typeof record.instantSell === "boolean") {
    return legacyInstantToPolicy(record.instantSell, "sell");
  }

  return createDefaultProfitFilterSettings().sellPolicy;
}

function parseMaxMarketCapacityRatioFilter(
  value: unknown,
): MaxMarketCapacityRatioFilter {
  const defaults = createDefaultProfitFilterSettings().maxMarketCapacityRatioFilter;
  if (typeof value !== "object" || value === null) return defaults;

  const record = value as Record<string, unknown>;
  const enabled =
    typeof record.enabled === "boolean" ? record.enabled : defaults.enabled;
  const rawValue =
    typeof record.value === "number" && Number.isFinite(record.value)
      ? record.value
      : defaults.value;

  return {
    enabled,
    value: Math.max(0, Math.min(1, rawValue)),
  };
}

export function normalizeProfitFilterSettings(
  value: unknown,
): ProfitFilterSettings {
  const defaults = createDefaultProfitFilterSettings();
  if (typeof value !== "object" || value === null) return defaults;

  const record = value as Record<string, unknown>;

  return {
    version: PROFIT_FILTER_SETTINGS_VERSION,
    selectedDate:
      typeof record.selectedDate === "string"
        ? record.selectedDate
        : defaults.selectedDate,
    buyPolicy: parseBuyPolicy(record),
    sellPolicy: parseSellPolicy(record),
    includeInstantActions:
      typeof record.includeInstantActions === "boolean"
        ? record.includeInstantActions
        : defaults.includeInstantActions,
    maxMarketCapacityRatioFilter: parseMaxMarketCapacityRatioFilter(
      record.maxMarketCapacityRatioFilter,
    ),
    search: typeof record.search === "string" ? record.search : defaults.search,
  };
}

export function loadProfitFilterSettings(): ProfitFilterSettings {
  if (typeof localStorage === "undefined") {
    return createDefaultProfitFilterSettings();
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultProfitFilterSettings();
    return normalizeProfitFilterSettings(JSON.parse(raw));
  } catch {
    return createDefaultProfitFilterSettings();
  }
}

export function saveProfitFilterSettings(settings: ProfitFilterSettings): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(normalizeProfitFilterSettings(settings)),
  );
}

export function clearProfitFilterSettings(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
