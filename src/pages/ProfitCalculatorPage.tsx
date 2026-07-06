import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { resolveSkillBonuses } from "../bonuses/resolve-bonuses.ts";
import type { PlayerGearSettings } from "../bonuses/gear-settings.ts";
import type { SkillBonuses, UpgradeCatalog } from "../bonuses/types.ts";
import { loadUpgradeCatalog } from "../bonuses/upgrade-catalog.ts";
import { CharacterTabs } from "../components/CharacterTabs.tsx";
import type { MonthlyArchive } from "../fetcher/types.ts";
import {
  currentMonthKey,
  loadMonthlyArchive,
} from "../lib/market-archive.ts";
import { buildPriceMap, pricingSummary, TRADE_POLICY_OPTIONS } from "../lib/market-prices.ts";
import type { TradePolicy } from "../lib/market-prices.ts";
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
import { formatSkillLabel } from "../recipes/skills.ts";
import {
  SKILL_SLUGS,
  type Recipe,
  type SkillRecipeFile,
  type SkillSlug,
} from "../recipes/types.ts";
import "./RecipesPage.css";
import "./ProfitCalculatorPage.css";

function formatIngredients(recipe: Recipe): string {
  if (recipe.ingredients.length === 0) return "—";
  return recipe.ingredients
    .map((ingredient) => `${ingredient.quantity}× ${ingredient.item}`)
    .join(", ");
}

function formatSecondaryOutput(recipe: Recipe): string {
  if (!recipe.secondaryOutput) return "";
  const { item, quantity } = recipe.secondaryOutput;
  return `${quantity}× ${item}`;
}

function formatQuantity(value: number): string {
  return formatCompactNumber(value);
}

function formatQuantitiesPerDay(items: QuantityPerDay[]): string {
  if (items.length === 0) return "—";
  return items
    .map((entry) => `${formatQuantity(entry.quantityPerDay)}× ${entry.item}`)
    .join(", ");
}

function formatRatio(value: number | null): string {
  if (value === null) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function formatTime(seconds: number): string {
  if (Number.isInteger(seconds)) return `${seconds}s`;
  return `${seconds.toFixed(1)}s`;
}

function formatGold(value: number | null): string {
  if (value === null) return "—";
  return formatCompactNumber(value);
}

function formatFetchedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
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
        setPlayerError(message);
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
      setPlayerError("Enter a username");
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
      setPlayerError(message);
    } finally {
      setPlayerLoading(false);
    }
  }, [username]);

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
        const skillMatch = formatSkillLabel(skill).toLowerCase().includes(query);
        const idMatch = recipe.id.toLowerCase().includes(query);
        const nameMatch = recipe.displayName.toLowerCase().includes(query);
        const productMatch = recipe.product.toLowerCase().includes(query);
        const ingredientMatch = recipe.ingredients.some((ingredient) =>
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

      const skillCompare = formatSkillLabel(a.skill).localeCompare(
        formatSkillLabel(b.skill),
      );
      if (skillCompare !== 0) return skillCompare;
      return a.recipe.displayName.localeCompare(b.recipe.displayName);
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
  ]);

  const hasPlayerBonuses = Boolean(playerBundle) || gearSettings.useManualGear;

  return (
    <main className="recipes-page">
      <header className="recipes-header">
        <h1>IdleClans Profit Calculator</h1>
        <p className="recipes-subtitle">
          All skills ranked by profit per day using market snapshots from{" "}
          <code>public/data/market/</code>
        </p>
      </header>

      <section className="profit-player-bar">
        <CharacterTabs
          roster={roster}
          onSelect={selectCharacter}
          onRemove={removeCharacter}
        />

        <label>
          Player
          <input
            type="text"
            placeholder="Username"
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
          {playerLoading ? "Loading…" : "Load"}
        </button>

        <Link
          to="/idleclans/player"
          className="profit-gear-link"
          state={{ username: roster.activeUsername }}
        >
          Gear loadout
        </Link>

        {playerBundle && (
          <p className="profit-player-status">
            <strong>{playerBundle.profile.username}</strong>
            {playerBundle.profile.guildName
              ? ` · ${playerBundle.profile.guildName}`
              : " · no clan"}
            {" · "}loaded {formatFetchedAt(playerBundle.fetchedAt)}
          </p>
        )}

        {playerError && (
          <p className="profit-player-error">{playerError}</p>
        )}

        {hasPlayerBonuses && (
          <p className="profit-bonus-summary">
            Player upgrades and manual gear apply per skill
            {gearSettings.useManualGear ? " (manual gear on)" : ""}.
          </p>
        )}
      </section>

      <section className="recipes-controls profit-controls">
        <label>
          Market snapshot
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
          Buy policy
          <select
            value={buyPolicy}
            onChange={(e) => setBuyPolicy(e.target.value as TradePolicy)}
          >
            {TRADE_POLICY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Sell policy
          <select
            value={sellPolicy}
            onChange={(e) => setSellPolicy(e.target.value as TradePolicy)}
          >
            {TRADE_POLICY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
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
          Include instant actions
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
          Filter by max market cap. ratio
        </label>

        <label>
          Max market capacity ratio (%)
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
          Search
          <input
            type="search"
            placeholder="skill, name, product, or ingredient"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        <button
          type="button"
          onClick={() => void loadData(true)}
          disabled={loading}
        >
          Refresh
        </button>

        <button type="button" onClick={resetFilters} disabled={loading}>
          Reset to default
        </button>
      </section>

      {loading && <p className="recipes-status">Loading data…</p>}
      {error && <p className="recipes-error">{error}</p>}

      {!loading && !error && allRecipeFiles && selectedSnapshot && (
        <>
          <p className="recipes-meta">
            {recipesCapturedAt && (
              <>
                Recipes captured at{" "}
                <time dateTime={recipesCapturedAt}>{recipesCapturedAt}</time>
                {" · "}
              </>
            )}
            Market captured at{" "}
            <time dateTime={selectedSnapshot.capturedAt}>
              {selectedSnapshot.capturedAt}
            </time>
            {" · "}
            {rows.length} of {totalRecipeCount} recipes
            {" · "}
            Pricing: {pricingSummary(buyPolicy, sellPolicy)}
          </p>

          {totalRecipeCount === 0 ? (
            <p className="recipes-status">No recipes loaded.</p>
          ) : (
            <div className="recipes-table-wrap">
              <table className="recipes-table profit-table">
                <thead>
                  <tr>
                    <th>Skill</th>
                    <th>Name</th>
                    <th>Time</th>
                    <th>Output</th>
                    <th>Ingredients</th>
                    <th>Secondary</th>
                    <th>Level</th>
                    <th className="profit-money">Ingredient cost</th>
                    <th className="profit-money">Value</th>
                    <th className="profit-money">Profit</th>
                    <th className="profit-money">Profit/Day</th>
                    <th className="profit-money">Actions/Day</th>
                    <th>Ingredients/Day</th>
                    <th>Output/Day</th>
                    <th className="profit-money">Max Market Cap. Ratio</th>
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
                        <td>{formatSkillLabel(skill)}</td>
                        <td>{recipe.displayName}</td>
                        <td
                          className={profit.isInstant ? "profit-instant" : ""}
                          title={
                            profit.isInstant
                              ? "Profit/Day assumes 0.1s"
                              : showEffectiveTime
                                ? `Base time: ${formatTime(recipe.baseTimeSeconds)}`
                                : undefined
                          }
                        >
                          {profit.isInstant
                            ? "Instant"
                            : showEffectiveTime
                              ? formatTime(profit.effectiveTimeSeconds)
                              : formatTime(recipe.baseTimeSeconds)}
                        </td>
                        <td>{recipe.outputAmount}</td>
                        <td className="recipes-ingredients">
                          {formatIngredients(recipe)}
                        </td>
                        <td>{formatSecondaryOutput(recipe)}</td>
                        <td>{recipe.levelRequired}</td>
                        <td className="profit-money">
                          {formatGold(profit.ingredientCost)}
                        </td>
                        <td className="profit-money">
                          {formatGold(profit.productValue)}
                        </td>
                        <td className={profitMoneyClass(profit.profit)}>
                          {formatGold(profit.profit)}
                        </td>
                        <td className={profitMoneyClass(profit.profitPerDay)}>
                          {formatGold(profit.profitPerDay)}
                        </td>
                        <td className="profit-money">
                          {formatQuantity(profit.actionsPerDay)}
                        </td>
                        <td className="recipes-ingredients">
                          {formatQuantitiesPerDay(profit.ingredientsPerDay)}
                        </td>
                        <td className="recipes-ingredients">
                          {formatQuantitiesPerDay(profit.outputsPerDay)}
                        </td>
                        <td
                          className={profitMoneyClass(profit.maxMarketCapacityRatio)}
                          title={
                            profit.maxMarketCapacityRatio !== null &&
                            profit.maxMarketCapacityRatio > 0
                              ? Object.entries(profit.marketCapacityRatios)
                                  .filter(([, ratio]) => ratio !== null)
                                  .map(([item, ratio]) => `${item}: ${formatRatio(ratio)}`)
                                  .join(", ")
                              : undefined
                          }
                        >
                          {formatRatio(profit.maxMarketCapacityRatio)}
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
