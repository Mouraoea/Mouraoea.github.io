import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { resolveSkillBonuses } from "../bonuses/resolve-bonuses.ts";
import type { PlayerGearSettings } from "../bonuses/gear-settings.ts";
import type { SkillBonuses, UpgradeCatalog } from "../bonuses/types.ts";
import { loadUpgradeCatalog } from "../bonuses/upgrade-catalog.ts";
import { CharacterTabs } from "../components/CharacterTabs.tsx";
import { useAppLocale } from "../components/LanguageSwitcher.tsx";
import type { MonthlyArchive } from "../fetcher/types.ts";
import {
  translateApiError,
  translateNameId,
  translateSkillSlug,
} from "../i18n/game-labels.ts";
import {
  currentMonthKey,
  loadMonthlyArchive,
} from "../lib/market-archive.ts";
import { buildPriceMap, TRADE_POLICY_OPTIONS } from "../lib/market-prices.ts";
import type { TradePolicy } from "../lib/market-prices.ts";
import { pricingSummary, translateTradePolicy } from "../lib/market-pricing-i18n.ts";
import { formatCompactNumber } from "../lib/format-compact-number.ts";
import {
  createDefaultProfitFilterSettings,
  loadProfitFilterSettings,
  saveProfitFilterSettings,
} from "../lib/profit-filter-storage.ts";
import {
  loadPlayerGearSettings,
  removePlayerGearSettings,
} from "../lib/player-gear-storage.ts";
import { fetchPlayerBundle } from "../lib/player-api.ts";
import {
  getActivePlayerBundle,
  loadPlayerRoster,
  removePlayerCharacter,
  setActivePlayerCharacter,
  upsertPlayerCharacter,
} from "../lib/player-storage.ts";
import type { PlayerRoster } from "../lib/player-storage.ts";
import { loadAllSkillRecipes } from "../recipes/parser.ts";
import { calculateRecipeProfit, type QuantityPerDay } from "../recipes/profit.ts";
import {
  SKILL_SLUGS,
  type Recipe,
  type SkillRecipeFile,
  type SkillSlug,
} from "../recipes/types.ts";
import "./RecipesPage.css";
import "./ProfitCalculatorPage.css";

function formatIngredients(recipe: Recipe, emDash: string): string {
  if (recipe.ingredients.length === 0) return emDash;
  return recipe.ingredients
    .map((ingredient) => `${ingredient.quantity}× ${translateNameId(ingredient.item)}`)
    .join(", ");
}

function formatSecondaryOutput(recipe: Recipe): string {
  if (!recipe.secondaryOutput) return "";
  const { item, quantity } = recipe.secondaryOutput;
  return `${quantity}× ${translateNameId(item)}`;
}

function formatQuantity(value: number, locale: string): string {
  return formatCompactNumber(value, locale);
}

function formatQuantitiesPerDay(items: QuantityPerDay[], locale: string, emDash: string): string {
  if (items.length === 0) return emDash;
  return items
    .map((entry) => `${formatQuantity(entry.quantityPerDay, locale)}× ${translateNameId(entry.item)}`)
    .join(", ");
}

function formatRatio(value: number | null, locale: string): string {
  if (value === null) return "—";
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatTime(seconds: number): string {
  if (Number.isInteger(seconds)) return `${seconds}s`;
  return `${seconds.toFixed(1)}s`;
}

function formatGold(value: number | null, locale: string, emDash: string): string {
  if (value === null) return emDash;
  return formatCompactNumber(value, locale);
}

function formatFetchedAt(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale).format(date);
}

function profitMoneyClass(value: number | null): string {
  if (value === null) return "profit-money";
  if (value > 0) return "profit-money profit-positive";
  if (value < 0) return "profit-money profit-negative";
  return "profit-money";
}

interface RecipeRow {
  skill: SkillSlug;
  recipe: Recipe;
  profit: ReturnType<typeof calculateRecipeProfit>;
}

export function ProfitCalculatorPage() {
  const { t } = useTranslation(["profit", "common"]);
  const locale = useAppLocale();
  const initialFilters = useMemo(() => loadProfitFilterSettings(), []);

  const [allRecipeFiles, setAllRecipeFiles] = useState<Record<
    SkillSlug,
    SkillRecipeFile
  > | null>(null);
  const [archive, setArchive] = useState<MonthlyArchive | null>(null);
  const [selectedDate, setSelectedDate] = useState(initialFilters.selectedDate);
  const [buyPolicy, setBuyPolicy] = useState<TradePolicy>(initialFilters.buyPolicy);
  const [sellPolicy, setSellPolicy] = useState<TradePolicy>(
    initialFilters.sellPolicy,
  );
  const [includeInstantActions, setIncludeInstantActions] = useState(
    initialFilters.includeInstantActions,
  );
  const [maxMarketCapacityRatioFilter, setMaxMarketCapacityRatioFilter] =
    useState(initialFilters.maxMarketCapacityRatioFilter);
  const [search, setSearch] = useState(initialFilters.search);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [roster, setRoster] = useState<PlayerRoster>(() => loadPlayerRoster());
  const playerBundle = useMemo(
    () => getActivePlayerBundle(roster),
    [roster],
  );
  const [upgradeCatalog, setUpgradeCatalog] = useState<UpgradeCatalog | null>(
    null,
  );
  const [playerLoading, setPlayerLoading] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [gearSettings, setGearSettings] = useState<PlayerGearSettings>(() =>
    loadPlayerGearSettings(loadPlayerRoster().activeUsername),
  );

  const month = currentMonthKey();
  const emDash = t("common:labels.emDash");

  const loadData = useCallback(async (bustCache = false) => {
    setLoading(true);
    setError(null);
    try {
      const [recipes, marketArchive] = await Promise.all([
        loadAllSkillRecipes(),
        loadMonthlyArchive(month, { bustCache }),
      ]);
      setAllRecipeFiles(recipes);
      setArchive(marketArchive);
      const latest = marketArchive.snapshots.at(-1);
      setSelectedDate((prev) => {
        if (prev && marketArchive.snapshots.some((s) => s.date === prev)) {
          return prev;
        }
        return latest?.date ?? "";
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setAllRecipeFiles(null);
      setArchive(null);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    saveProfitFilterSettings({
      version: 1,
      selectedDate,
      buyPolicy,
      sellPolicy,
      includeInstantActions,
      maxMarketCapacityRatioFilter,
      search,
    });
  }, [
    selectedDate,
    buyPolicy,
    sellPolicy,
    includeInstantActions,
    maxMarketCapacityRatioFilter,
    search,
  ]);

  const resetFilters = useCallback(() => {
    const defaults = createDefaultProfitFilterSettings();
    const latestDate = archive?.snapshots.at(-1)?.date ?? defaults.selectedDate;
    setSelectedDate(latestDate);
    setBuyPolicy(defaults.buyPolicy);
    setSellPolicy(defaults.sellPolicy);
    setIncludeInstantActions(defaults.includeInstantActions);
    setMaxMarketCapacityRatioFilter(defaults.maxMarketCapacityRatioFilter);
    setSearch(defaults.search);
    saveProfitFilterSettings({ ...defaults, selectedDate: latestDate });
  }, [archive]);

  useEffect(() => {
    const initialRoster = loadPlayerRoster();
    setRoster(initialRoster);
    const active = getActivePlayerBundle(initialRoster);
    if (active) {
      setUsername(active.username);
      setGearSettings(loadPlayerGearSettings(active.username));
    }

    void loadUpgradeCatalog()
      .then(setUpgradeCatalog)
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        setPlayerError(translateApiError(message));
      });

    const refreshGearSettings = () => {
      const current = loadPlayerRoster();
      setGearSettings(loadPlayerGearSettings(current.activeUsername));
    };
    refreshGearSettings();
    window.addEventListener("focus", refreshGearSettings);
    return () => window.removeEventListener("focus", refreshGearSettings);
  }, []);

  const selectCharacter = useCallback((name: string) => {
    const next = setActivePlayerCharacter(name);
    setRoster(next);
    setUsername(name);
    setGearSettings(loadPlayerGearSettings(name));
    setPlayerError(null);
  }, []);

  const removeCharacter = useCallback((name: string) => {
    removePlayerGearSettings(name);
    const next = removePlayerCharacter(name);
    setRoster(next);
    const active = getActivePlayerBundle(next);
    setUsername(active?.username ?? "");
    setGearSettings(loadPlayerGearSettings(active?.username ?? null));
    setPlayerError(null);
  }, []);

  const loadPlayer = useCallback(async () => {
    const trimmed = username.trim();
    if (!trimmed) {
      setPlayerError(t("common:errors.usernameRequired"));
      return;
    }

    setPlayerLoading(true);
    setPlayerError(null);
    try {
      const bundle = await fetchPlayerBundle(trimmed);
      const next = upsertPlayerCharacter(bundle);
      setRoster(next);
      setUsername(bundle.username);
      setGearSettings(loadPlayerGearSettings(bundle.username));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setPlayerError(translateApiError(message));
    } finally {
      setPlayerLoading(false);
    }
  }, [username, t]);

  const selectedSnapshot = useMemo(
    () => archive?.snapshots.find((s) => s.date === selectedDate),
    [archive, selectedDate],
  );

  const priceMap = useMemo(
    () => (selectedSnapshot ? buildPriceMap(selectedSnapshot) : new Map()),
    [selectedSnapshot],
  );

  const skillBonusesBySkill = useMemo(() => {
    const map = new Map<SkillSlug, SkillBonuses>();
    for (const skill of SKILL_SLUGS) {
      map.set(
        skill,
        resolveSkillBonuses(
          skill,
          playerBundle?.profile ?? null,
          playerBundle?.clan ?? null,
          upgradeCatalog,
          gearSettings,
        ),
      );
    }
    return map;
  }, [playerBundle, upgradeCatalog, gearSettings]);

  const totalRecipeCount = useMemo(() => {
    if (!allRecipeFiles) return 0;
    return SKILL_SLUGS.reduce(
      (sum, skill) => sum + (allRecipeFiles[skill]?.recipes.length ?? 0),
      0,
    );
  }, [allRecipeFiles]);

  const recipesCapturedAt = useMemo(() => {
    if (!allRecipeFiles) return null;
    let latest: string | null = null;
    for (const skill of SKILL_SLUGS) {
      const capturedAt = allRecipeFiles[skill]?.capturedAt;
      if (!capturedAt) continue;
      if (!latest || capturedAt > latest) latest = capturedAt;
    }
    return latest;
  }, [allRecipeFiles]);

  const rows = useMemo((): RecipeRow[] => {
    if (!allRecipeFiles || !selectedSnapshot) return [];

    const query = search.trim().toLowerCase();
    const flat: RecipeRow[] = [];

    for (const skill of SKILL_SLUGS) {
      const file = allRecipeFiles[skill];
      if (!file) continue;

      const bonuses = skillBonusesBySkill.get(skill);
      const pricingOptions = {
        buyPolicy,
        sellPolicy,
        bonuses,
      };

      for (const recipe of file.recipes) {
        flat.push({
          skill,
          recipe,
          profit: calculateRecipeProfit(recipe, priceMap, pricingOptions),
        });
      }
    }

    let filtered = flat;
    if (!includeInstantActions) {
      filtered = filtered.filter((row) => !row.profit.isInstant);
    }

    if (maxMarketCapacityRatioFilter.enabled) {
      const maxRatio = maxMarketCapacityRatioFilter.value;
      filtered = filtered.filter((row) => {
        const ratio = row.profit.maxMarketCapacityRatio;
        if (ratio === null) return true;
        return ratio <= maxRatio;
      });
    }

    if (query) {
      filtered = filtered.filter(({ skill, recipe }) => {
        const skillMatch = translateSkillSlug(skill).toLowerCase().includes(query);
        const idMatch = recipe.id.toLowerCase().includes(query);
        const nameMatch = translateNameId(recipe.id).toLowerCase().includes(query);
        const productMatch = translateNameId(recipe.product).toLowerCase().includes(query);
        const ingredientMatch = recipe.ingredients.some((ingredient) =>
          translateNameId(ingredient.item).toLowerCase().includes(query) ||
          ingredient.item.toLowerCase().includes(query),
        );
        return skillMatch || idMatch || nameMatch || productMatch || ingredientMatch;
      });
    }

    return filtered.sort((a, b) => {
      const aDay = a.profit.profitPerDay;
      const bDay = b.profit.profitPerDay;
      if (aDay !== null && bDay !== null && aDay !== bDay) {
        return bDay - aDay;
      }
      if (aDay !== null && bDay === null) return -1;
      if (aDay === null && bDay !== null) return 1;

      const aProfit = a.profit.profit;
      const bProfit = b.profit.profit;
      if (aProfit !== null && bProfit !== null && aProfit !== bProfit) {
        return bProfit - aProfit;
      }
      if (aProfit !== null && bProfit === null) return -1;
      if (aProfit === null && bProfit !== null) return 1;

      const skillCompare = translateSkillSlug(a.skill).localeCompare(
        translateSkillSlug(b.skill),
        locale,
      );
      if (skillCompare !== 0) return skillCompare;
      return translateNameId(a.recipe.id).localeCompare(
        translateNameId(b.recipe.id),
        locale,
      );
    });
  }, [
    allRecipeFiles,
    selectedSnapshot,
    search,
    priceMap,
    buyPolicy,
    sellPolicy,
    includeInstantActions,
    maxMarketCapacityRatioFilter,
    skillBonusesBySkill,
    locale,
  ]);

  const hasPlayerBonuses = Boolean(playerBundle) || gearSettings.useManualGear;

  return (
    <main className="recipes-page">
      <header className="recipes-header">
        <h1>{t("profit:title")}</h1>
        <p
          className="recipes-subtitle"
          dangerouslySetInnerHTML={{ __html: t("profit:subtitle") }}
        />
      </header>

      <section className="profit-player-bar">
        <CharacterTabs
          roster={roster}
          onSelect={selectCharacter}
          onRemove={removeCharacter}
        />

        <label>
          {t("profit:player")}
          <input
            type="text"
            placeholder={t("profit:usernamePlaceholder")}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void loadPlayer();
              }
            }}
            disabled={playerLoading}
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        <button
          type="button"
          onClick={() => void loadPlayer()}
          disabled={playerLoading}
        >
          {playerLoading ? t("common:actions.loading") : t("common:actions.load")}
        </button>

        <Link
          to="/idleclans/player"
          className="profit-gear-link"
          state={{ username: roster.activeUsername }}
        >
          {t("common:nav.gearLoadout")}
        </Link>

        {playerBundle && (
          <p className="profit-player-status">
            <strong>{playerBundle.profile.username}</strong>
            {playerBundle.profile.guildName
              ? ` · ${playerBundle.profile.guildName}`
              : ` · ${t("profit:noClan")}`}
            {" · "}
            {t("profit:loadedAt", {
              time: formatFetchedAt(playerBundle.fetchedAt, locale),
            })}
          </p>
        )}

        {playerError && (
          <p className="profit-player-error">{playerError}</p>
        )}

        {hasPlayerBonuses && (
          <p className="profit-bonus-summary">
            {t("profit:bonusSummary", {
              manualGear: gearSettings.useManualGear
                ? t("profit:manualGearOn")
                : "",
            })}
          </p>
        )}
      </section>

      <section className="recipes-controls profit-controls">
        <label>
          {t("profit:marketSnapshot")}
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            disabled={!archive?.snapshots.length}
          >
            {archive?.snapshots.map((snapshot) => (
              <option key={snapshot.date} value={snapshot.date}>
                {snapshot.date}
              </option>
            ))}
          </select>
        </label>

        <label>
          {t("profit:buyPolicy")}
          <select
            value={buyPolicy}
            onChange={(e) => setBuyPolicy(e.target.value as TradePolicy)}
          >
            {TRADE_POLICY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {translateTradePolicy(option.value)}
              </option>
            ))}
          </select>
        </label>

        <label>
          {t("profit:sellPolicy")}
          <select
            value={sellPolicy}
            onChange={(e) => setSellPolicy(e.target.value as TradePolicy)}
          >
            {TRADE_POLICY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {translateTradePolicy(option.value)}
              </option>
            ))}
          </select>
        </label>

        <label className="profit-toggle">
          <input
            type="checkbox"
            checked={includeInstantActions}
            onChange={(e) => setIncludeInstantActions(e.target.checked)}
          />
          {t("profit:includeInstantActions")}
        </label>

        <label className="profit-toggle">
          <input
            type="checkbox"
            checked={maxMarketCapacityRatioFilter.enabled}
            onChange={(e) =>
              setMaxMarketCapacityRatioFilter((prev) => ({
                ...prev,
                enabled: e.target.checked,
              }))
            }
          />
          {t("profit:filterByMaxMarketCapRatio")}
        </label>

        <label>
          {t("profit:maxMarketCapacityRatio")}
          <input
            type="number"
            min="0"
            max="100"
            step="1"
            value={maxMarketCapacityRatioFilter.value * 100}
            onChange={(e) =>
              setMaxMarketCapacityRatioFilter((prev) => ({
                ...prev,
                value: Number(e.target.value) / 100,
              }))
            }
            disabled={!maxMarketCapacityRatioFilter.enabled}
          />
        </label>

        <label>
          {t("common:labels.search")}
          <input
            type="search"
            placeholder={t("profit:searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        <button
          type="button"
          onClick={() => void loadData(true)}
          disabled={loading}
        >
          {t("common:actions.refresh")}
        </button>

        <button type="button" onClick={resetFilters} disabled={loading}>
          {t("common:actions.resetToDefault")}
        </button>
      </section>

      {loading && <p className="recipes-status">{t("profit:loading")}</p>}
      {error && <p className="recipes-error">{error}</p>}

      {!loading && !error && allRecipeFiles && selectedSnapshot && (
        <>
          <p className="recipes-meta">
            {recipesCapturedAt && (
              <>
                {t("profit:recipesCapturedAt")}{" "}
                <time dateTime={recipesCapturedAt}>
                  {new Intl.DateTimeFormat(locale).format(new Date(recipesCapturedAt))}
                </time>
                {" · "}
              </>
            )}
            {t("profit:marketCapturedAt")}{" "}
            <time dateTime={selectedSnapshot.capturedAt}>
              {new Intl.DateTimeFormat(locale).format(new Date(selectedSnapshot.capturedAt))}
            </time>
            {" · "}
            {rows.length} {t("common:meta.of")} {totalRecipeCount} {t("common:meta.recipes")}
            {" · "}
            {t("common:meta.pricing")}: {pricingSummary(buyPolicy, sellPolicy)}
          </p>

          {totalRecipeCount === 0 ? (
            <p className="recipes-status">{t("profit:noRecipesLoaded")}</p>
          ) : (
            <div className="recipes-table-wrap">
              <table className="recipes-table profit-table">
                <thead>
                  <tr>
                    <th>{t("profit:table.skill")}</th>
                    <th>{t("profit:table.name")}</th>
                    <th>{t("profit:table.time")}</th>
                    <th>{t("profit:table.output")}</th>
                    <th>{t("profit:table.ingredients")}</th>
                    <th>{t("profit:table.secondary")}</th>
                    <th>{t("profit:table.level")}</th>
                    <th className="profit-money">{t("profit:table.ingredientCost")}</th>
                    <th className="profit-money">{t("profit:table.value")}</th>
                    <th className="profit-money">{t("profit:table.profit")}</th>
                    <th className="profit-money">{t("profit:table.profitPerDay")}</th>
                    <th className="profit-money">{t("profit:table.actionsPerDay")}</th>
                    <th>{t("profit:table.ingredientsPerDay")}</th>
                    <th>{t("profit:table.outputPerDay")}</th>
                    <th className="profit-money">{t("profit:table.maxMarketCapRatio")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ skill, recipe, profit }) => {
                    const bonuses = skillBonusesBySkill.get(skill);
                    const showEffectiveTime =
                      !profit.isInstant &&
                      bonuses &&
                      profit.effectiveTimeSeconds !== recipe.baseTimeSeconds;

                    return (
                      <tr key={`${skill}-${recipe.id}`}>
                        <td>{translateSkillSlug(skill)}</td>
                        <td>{translateNameId(recipe.id)}</td>
                        <td
                          className={profit.isInstant ? "profit-instant" : ""}
                          title={
                            profit.isInstant
                              ? t("profit:tooltips.profitPerDayInstant")
                              : showEffectiveTime
                                ? t("profit:tooltips.baseTime", {
                                    time: formatTime(recipe.baseTimeSeconds),
                                  })
                                : undefined
                          }
                        >
                          {profit.isInstant
                            ? t("common:labels.instant")
                            : showEffectiveTime
                              ? formatTime(profit.effectiveTimeSeconds)
                              : formatTime(recipe.baseTimeSeconds)}
                        </td>
                        <td>{recipe.outputAmount}</td>
                        <td className="recipes-ingredients">
                          {formatIngredients(recipe, emDash)}
                        </td>
                        <td>{formatSecondaryOutput(recipe)}</td>
                        <td>{recipe.levelRequired}</td>
                        <td className="profit-money">
                          {formatGold(profit.ingredientCost, locale, emDash)}
                        </td>
                        <td className="profit-money">
                          {formatGold(profit.productValue, locale, emDash)}
                        </td>
                        <td className={profitMoneyClass(profit.profit)}>
                          {formatGold(profit.profit, locale, emDash)}
                        </td>
                        <td className={profitMoneyClass(profit.profitPerDay)}>
                          {formatGold(profit.profitPerDay, locale, emDash)}
                        </td>
                        <td className="profit-money">
                          {formatQuantity(profit.actionsPerDay, locale)}
                        </td>
                        <td className="recipes-ingredients">
                          {formatQuantitiesPerDay(profit.ingredientsPerDay, locale, emDash)}
                        </td>
                        <td className="recipes-ingredients">
                          {formatQuantitiesPerDay(profit.outputsPerDay, locale, emDash)}
                        </td>
                        <td
                          className={profitMoneyClass(profit.maxMarketCapacityRatio)}
                          title={
                            profit.maxMarketCapacityRatio !== null &&
                            profit.maxMarketCapacityRatio > 0
                              ? Object.entries(profit.marketCapacityRatios)
                                  .filter(([, ratio]) => ratio !== null)
                                  .map(([item, ratio]) =>
                                    `${translateNameId(item)}: ${formatRatio(ratio, locale)}`,
                                  )
                                  .join(", ")
                              : undefined
                          }
                        >
                          {formatRatio(profit.maxMarketCapacityRatio, locale)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </main>
  );
}
