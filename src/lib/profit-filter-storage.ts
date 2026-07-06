export const PROFIT_FILTER_SETTINGS_VERSION = 1 as const;

const STORAGE_KEY = "idleclans-profit-filter-settings";

export interface MaxMarketCapacityRatioFilter {
  enabled: boolean;
  value: number;
}

export interface ProfitFilterSettings {
  version: typeof PROFIT_FILTER_SETTINGS_VERSION;
  selectedDate: string;
  instantBuy: boolean;
  instantSell: boolean;
  includeInstantActions: boolean;
  maxMarketCapacityRatioFilter: MaxMarketCapacityRatioFilter;
  search: string;
}

export function createDefaultProfitFilterSettings(): ProfitFilterSettings {
  return {
    version: PROFIT_FILTER_SETTINGS_VERSION,
    selectedDate: "",
    instantBuy: true,
    instantSell: true,
    includeInstantActions: true,
    maxMarketCapacityRatioFilter: { enabled: false, value: 0.1 },
    search: "",
  };
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
    instantBuy:
      typeof record.instantBuy === "boolean"
        ? record.instantBuy
        : defaults.instantBuy,
    instantSell:
      typeof record.instantSell === "boolean"
        ? record.instantSell
        : defaults.instantSell,
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
