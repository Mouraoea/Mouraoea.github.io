import { useCallback, useEffect, useMemo, useState } from "react";
import {
  bonusesAreActive,
  formatSkillBonusesSummary,
  resolveSkillBonuses,
} from "../bonuses/resolve-bonuses.ts";
import type { PlayerBundle, UpgradeCatalog } from "../bonuses/types.ts";
import { loadUpgradeCatalog } from "../bonuses/upgrade-catalog.ts";
import type { MonthlyArchive } from "../fetcher/types.ts";
import {
  currentMonthKey,
  loadMonthlyArchive,
} from "../lib/market-archive.ts";
import { buildPriceMap } from "../lib/market-prices.ts";
import { fetchPlayerBundle } from "../lib/player-api.ts";
import {
  clearPlayerBundle,
  loadPlayerBundle,
  savePlayerBundle,
} from "../lib/player-storage.ts";
import { loadSkillRecipes } from "../recipes/parser.ts";
import { calculateRecipeProfit } from "../recipes/profit.ts";
import { formatSkillLabel, SKILL_GROUPS } from "../recipes/skills.ts";
import type { Recipe, SkillRecipeFile, SkillSlug } from "../recipes/types.ts";
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

function formatTime(seconds: number): string {
  if (Number.isInteger(seconds)) return `${seconds}s`;
  return `${seconds.toFixed(1)}s`;
}

function formatGold(value: number | null): string {
  if (value === null) return "—";
  return value.toLocaleString();
}

function formatFetchedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

interface RecipeRow {
  recipe: Recipe;
  profit: ReturnType<typeof calculateRecipeProfit>;
}

export function ProfitCalculatorPage() {
  const [skill, setSkill] = useState<SkillSlug>("smithing");
  const [recipeFile, setRecipeFile] = useState<SkillRecipeFile | null>(null);
  const [archive, setArchive] = useState<MonthlyArchive | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [instantBuy, setInstantBuy] = useState(true);
  const [instantSell, setInstantSell] = useState(true);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [playerBundle, setPlayerBundle] = useState<PlayerBundle | null>(null);
  const [upgradeCatalog, setUpgradeCatalog] = useState<UpgradeCatalog | null>(
    null,
  );
  const [playerLoading, setPlayerLoading] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);

  const month = currentMonthKey();

  const loadData = useCallback(
    async (selectedSkill: SkillSlug, bustCache = false) => {
      setLoading(true);
      setError(null);
      try {
        const [recipes, marketArchive] = await Promise.all([
          loadSkillRecipes(selectedSkill),
          loadMonthlyArchive(month, { bustCache }),
        ]);
        setRecipeFile(recipes);
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
        setRecipeFile(null);
        setArchive(null);
      } finally {
        setLoading(false);
      }
    },
    [month],
  );

  useEffect(() => {
    void loadData(skill);
  }, [skill, loadData]);

  useEffect(() => {
    const cached = loadPlayerBundle();
    if (cached) {
      setPlayerBundle(cached);
      setUsername(cached.username);
    }

    void loadUpgradeCatalog()
      .then(setUpgradeCatalog)
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        setPlayerError(message);
      });
  }, []);

  const loadPlayer = useCallback(async () => {
    const trimmed = username.trim();
    if (!trimmed) {
      setPlayerError("Enter a username");
      setPlayerBundle(null);
      clearPlayerBundle();
      return;
    }

    setPlayerLoading(true);
    setPlayerError(null);
    try {
      const bundle = await fetchPlayerBundle(trimmed);
      setPlayerBundle(bundle);
      setUsername(bundle.username);
      savePlayerBundle(bundle);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setPlayerError(message);
      setPlayerBundle(null);
      clearPlayerBundle();
    } finally {
      setPlayerLoading(false);
    }
  }, [username]);

  const selectedSnapshot = useMemo(
    () => archive?.snapshots.find((s) => s.date === selectedDate),
    [archive, selectedDate],
  );

  const priceMap = useMemo(
    () =>
      selectedSnapshot ? buildPriceMap(selectedSnapshot) : new Map(),
    [selectedSnapshot],
  );

  const skillBonuses = useMemo(
    () =>
      resolveSkillBonuses(
        skill,
        playerBundle?.profile ?? null,
        playerBundle?.clan ?? null,
        upgradeCatalog,
      ),
    [skill, playerBundle, upgradeCatalog],
  );

  const pricingOptions = useMemo(
    () => ({ instantBuy, instantSell, bonuses: skillBonuses }),
    [instantBuy, instantSell, skillBonuses],
  );

  const rows = useMemo((): RecipeRow[] => {
    if (!recipeFile || !selectedSnapshot) return [];

    const query = search.trim().toLowerCase();
    let recipes = recipeFile.recipes;

    if (query) {
      recipes = recipes.filter((recipe) => {
        const idMatch = recipe.id.toLowerCase().includes(query);
        const nameMatch = recipe.displayName.toLowerCase().includes(query);
        const productMatch = recipe.product.toLowerCase().includes(query);
        const ingredientMatch = recipe.ingredients.some((ingredient) =>
          ingredient.item.toLowerCase().includes(query),
        );
        return idMatch || nameMatch || productMatch || ingredientMatch;
      });
    }

    const withProfit = recipes.map((recipe) => ({
      recipe,
      profit: calculateRecipeProfit(recipe, priceMap, pricingOptions),
    }));

    return withProfit.sort((a, b) => {
      const aProfit = a.profit.profit;
      const bProfit = b.profit.profit;
      if (aProfit !== null && bProfit !== null && aProfit !== bProfit) {
        return bProfit - aProfit;
      }
      if (aProfit !== null && bProfit === null) return -1;
      if (aProfit === null && bProfit !== null) return 1;
      return a.recipe.displayName.localeCompare(b.recipe.displayName);
    });
  }, [recipeFile, selectedSnapshot, search, priceMap, pricingOptions]);

  const bonusesActive = bonusesAreActive(skillBonuses);

  return (
    <main className="recipes-page">
      <header className="recipes-header">
        <h1>IdleClans Profit Calculator</h1>
        <p className="recipes-subtitle">
          Recipe margins using market snapshots from{" "}
          <code>public/data/market/</code>
        </p>
      </header>

      <section className="profit-player-bar">
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
        {playerBundle && bonusesActive && (
          <p className="profit-bonus-summary">
            {formatSkillLabel(skill)} bonuses:{" "}
            {formatSkillBonusesSummary(skillBonuses)}
          </p>
        )}
      </section>

      <section className="recipes-controls profit-controls">
        <label>
          Skill
          <select
            value={skill}
            onChange={(e) => setSkill(e.target.value as SkillSlug)}
          >
            {SKILL_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.slugs.map((slug) => (
                  <option key={slug} value={slug}>
                    {formatSkillLabel(slug)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

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

        <label className="profit-toggle">
          <input
            type="checkbox"
            checked={instantBuy}
            onChange={(e) => setInstantBuy(e.target.checked)}
          />
          Instant buy
        </label>

        <label className="profit-toggle">
          <input
            type="checkbox"
            checked={instantSell}
            onChange={(e) => setInstantSell(e.target.checked)}
          />
          Instant sell
        </label>

        <label>
          Search
          <input
            type="search"
            placeholder="name, product, or ingredient"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        <button
          type="button"
          onClick={() => void loadData(skill, true)}
          disabled={loading}
        >
          Refresh
        </button>
      </section>

      {loading && <p className="recipes-status">Loading data…</p>}
      {error && <p className="recipes-error">{error}</p>}

      {!loading && !error && recipeFile && selectedSnapshot && (
        <>
          <p className="recipes-meta">
            Recipes captured at{" "}
            <time dateTime={recipeFile.capturedAt}>{recipeFile.capturedAt}</time>
            {" · "}
            Market captured at{" "}
            <time dateTime={selectedSnapshot.capturedAt}>
              {selectedSnapshot.capturedAt}
            </time>
            {" · "}
            {rows.length} of {recipeFile.recipes.length} recipes
            {" · "}
            Instant buy: {instantBuy ? "lowest sell" : "highest buy"}
            {" · "}
            Instant sell: {instantSell ? "highest buy" : "lowest sell"}
          </p>

          {recipeFile.recipes.length === 0 ? (
            <p className="recipes-status">No recipes for this skill.</p>
          ) : (
            <div className="recipes-table-wrap">
              <table className="recipes-table profit-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Time</th>
                    <th>Output</th>
                    <th>Ingredients</th>
                    <th>Secondary</th>
                    <th>Level</th>
                    <th className="profit-money">Ingredient cost</th>
                    <th className="profit-money">Value</th>
                    <th className="profit-money">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ recipe, profit }) => {
                    const showEffectiveTime =
                      bonusesActive &&
                      profit.effectiveTimeSeconds !== recipe.baseTimeSeconds;
                    return (
                      <tr key={recipe.id}>
                        <td>{recipe.displayName}</td>
                        <td
                          title={
                            showEffectiveTime
                              ? `Base time: ${formatTime(recipe.baseTimeSeconds)}`
                              : undefined
                          }
                        >
                          {showEffectiveTime
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
                        <td
                          className={[
                            "profit-money",
                            profit.profit !== null && profit.profit > 0
                              ? "profit-positive"
                              : profit.profit !== null && profit.profit < 0
                                ? "profit-negative"
                                : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {formatGold(profit.profit)}
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
