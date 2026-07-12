import { useCallback, useEffect, useMemo, useState } from "react";

import { useTranslation } from "react-i18next";

import { resolveSkillBonuses } from "../bonuses/resolve-bonuses.ts";

import { MAX_GEAR_PRESETS } from "../bonuses/gear-settings.ts";

import type { SkillBonuses } from "../bonuses/types.ts";

import { PlayerBonusBar } from "../components/PlayerBonusBar.tsx";

import { ProfitRecipeDetailModal } from "../components/ProfitRecipeDetailModal.tsx";

import { useAppLocale } from "../components/LanguageSwitcher.tsx";

import type { MonthlyArchive } from "../fetcher/types.ts";

import {
  translateNameId,
  translateSkillSlug,
} from "../i18n/game-labels.ts";

import {

  currentMonthKey,

  findSnapshotByKey,

  formatSnapshotOptionLabel,

  loadMonthlyArchive,

  snapshotSelectKey,

} from "../lib/market-archive.ts";

import { buildSanitizedPriceMap, TRADE_POLICY_OPTIONS } from "../lib/market-prices.ts";

import type { TradePolicy } from "../lib/market-prices.ts";

import { translateTradePolicy } from "../lib/market-pricing-i18n.ts";

import {
  formatGold,
  profitMoneyClass,
} from "../lib/profit-format.ts";

import {

  createDefaultProfitFilterSettings,

  loadProfitFilterSettings,

  saveProfitFilterSettings,

} from "../lib/profit-filter-storage.ts";

import { usePlayerBonusContext } from "../hooks/usePlayerBonusContext.ts";

import { loadAllSkillRecipes } from "../recipes/parser.ts";

import { calculateRecipeProfit } from "../recipes/profit.ts";

import type { RecipeRow } from "../recipes/profit-row.ts";

import {

  SKILL_SLUGS,

  type SkillRecipeFile,

  type SkillSlug,

} from "../recipes/types.ts";

import "./ProfitCalculatorPage.css";



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

  const [selectedRow, setSelectedRow] = useState<RecipeRow | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);



  const playerContext = usePlayerBonusContext();

  const {
    playerBundle,
    upgradeCatalog,
    gearSettings,
  } = playerContext;



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
        if (prev && findSnapshotByKey(marketArchive.snapshots, prev)) {
          return prev;
        }
        return latest ? snapshotSelectKey(latest) : "";
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

    const latestKey =
      archive?.snapshots.at(-1)
        ? snapshotSelectKey(archive.snapshots.at(-1)!)
        : defaults.selectedDate;

    setSelectedDate(latestKey);

    setBuyPolicy(defaults.buyPolicy);

    setSellPolicy(defaults.sellPolicy);

    setIncludeInstantActions(defaults.includeInstantActions);

    setMaxMarketCapacityRatioFilter(defaults.maxMarketCapacityRatioFilter);

    setSearch(defaults.search);

    saveProfitFilterSettings({ ...defaults, selectedDate: latestKey });

  }, [archive]);



  const selectedSnapshot = useMemo(
    () =>
      archive ? findSnapshotByKey(archive.snapshots, selectedDate) : undefined,
    [archive, selectedDate],
  );



  const priceMap = useMemo(

    () =>
      selectedSnapshot && archive
        ? buildSanitizedPriceMap(selectedSnapshot, archive.snapshots)
        : new Map(),

    [archive, selectedSnapshot],

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



  const loadoutCompare = useMemo(() => {

    if (

      !allRecipeFiles ||

      !selectedSnapshot ||

      !gearSettings.useManualGear ||

      !playerBundle

    ) {

      return null;

    }



    const compareEntries: Array<{ index: number; bestProfitPerDay: number | null }> = [];



    for (let presetIndex = 0; presetIndex < MAX_GEAR_PRESETS; presetIndex++) {

      let bestProfitPerDay: number | null = null;



      for (const skill of SKILL_SLUGS) {

        const file = allRecipeFiles[skill];

        if (!file) continue;



        const bonuses = resolveSkillBonuses(

          skill,

          playerBundle.profile,

          playerBundle.clan,

          upgradeCatalog,

          gearSettings,

          presetIndex,

        );



        for (const recipe of file.recipes) {

          const profit = calculateRecipeProfit(recipe, priceMap, {

            buyPolicy,

            sellPolicy,

            bonuses,

          });



          if (!includeInstantActions && profit.isInstant) continue;



          if (maxMarketCapacityRatioFilter.enabled) {

            const ratio = profit.maxMarketCapacityRatio;

            if (ratio !== null && ratio > maxMarketCapacityRatioFilter.value) {

              continue;

            }

          }



          if (

            profit.profitPerDay !== null &&

            (bestProfitPerDay === null || profit.profitPerDay > bestProfitPerDay)

          ) {

            bestProfitPerDay = profit.profitPerDay;

          }

        }

      }



      compareEntries.push({ index: presetIndex, bestProfitPerDay });

    }



    return compareEntries;

  }, [

    allRecipeFiles,

    selectedSnapshot,

    gearSettings,

    playerBundle,

    upgradeCatalog,

    priceMap,

    buyPolicy,

    sellPolicy,

    includeInstantActions,

    maxMarketCapacityRatioFilter,

  ]);



  return (

    <main className="page">

      <header className="page-header">

        <h1>{t("profit:title")}</h1>

      </header>



      <PlayerBonusBar context={playerContext} />



      {loadoutCompare && (

        <section className="card card-warning profit-loadout-compare">

          <span className="profit-loadout-compare-title">

            {t("profit:loadoutCompareTitle")}

          </span>

          {loadoutCompare.map(({ index, bestProfitPerDay }) => (

            <span

              key={index}

              className={[

                "chip",

                index === gearSettings.activePresetIndex ? "chip-active" : "",

              ]

                .filter(Boolean)

                .join(" ")}

            >

              {t("profit:loadoutCompareEntry", {

                number: index + 1,

                value: formatGold(bestProfitPerDay, locale, emDash),

              })}

            </span>

          ))}

        </section>

      )}



      <section className="control-bar profit-controls">

        <label className="field">

          {t("profit:marketSnapshot")}

          <select

            value={selectedDate}

            onChange={(e) => setSelectedDate(e.target.value)}

            disabled={!archive?.snapshots.length}

          >

            {archive?.snapshots.map((snapshot) => (
              <option key={snapshot.capturedAt} value={snapshotSelectKey(snapshot)}>
                {formatSnapshotOptionLabel(snapshot, archive.snapshots, locale)}
              </option>
            ))}

          </select>

        </label>



        <label className="field">

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



        <label className="field">

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



        <label className="field field-toggle">

          <input

            type="checkbox"

            checked={includeInstantActions}

            onChange={(e) => setIncludeInstantActions(e.target.checked)}

          />

          {t("profit:includeInstantActions")}

        </label>



        <label className="field field-toggle">

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



        <label className="field">

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



        <label className="field">

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

          className="btn btn-primary"

          onClick={() => void loadData(true)}

          disabled={loading}

        >

          {t("common:actions.refresh")}

        </button>



        <button type="button" className="btn" onClick={resetFilters} disabled={loading}>

          {t("common:actions.resetToDefault")}

        </button>

      </section>



      {loading && <p className="status-text">{t("profit:loading")}</p>}

      {error && <p className="status-error">{error}</p>}



      {!loading && !error && allRecipeFiles && selectedSnapshot && (

        <>

          {totalRecipeCount > 0 ? (

            <p className="status-text profit-table-hint">{t("profit:table.tapForDetails")}</p>

          ) : null}



          {totalRecipeCount === 0 ? (

            <p className="status-text">{t("profit:noRecipesLoaded")}</p>

          ) : (

            <div className="table-wrap">

              <table className="data-table profit-table">

                <thead>

                  <tr>

                    <th>{t("profit:table.name")}</th>

                    <th className="profit-money">{t("profit:table.profitPerDay")}</th>

                  </tr>

                </thead>

                <tbody>

                  {rows.map(({ skill, recipe, profit }) => {

                    const recipeName = translateNameId(recipe.id);



                    return (

                      <tr

                        key={`${skill}-${recipe.id}`}

                        className="profit-row-clickable"

                        tabIndex={0}

                        role="button"

                        aria-label={t("profit:rowDetails", { name: recipeName })}

                        onClick={() => setSelectedRow({ skill, recipe, profit })}

                        onKeyDown={(event) => {

                          if (event.key === "Enter" || event.key === " ") {

                            event.preventDefault();

                            setSelectedRow({ skill, recipe, profit });

                          }

                        }}

                      >

                        <td>

                          <span className="profit-row-name">{recipeName}</span>

                          <span className="profit-row-skill">{translateSkillSlug(skill)}</span>

                        </td>

                        <td className={profitMoneyClass(profit.profitPerDay)}>

                          {formatGold(profit.profitPerDay, locale, emDash)}

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



      <ProfitRecipeDetailModal

        row={selectedRow}

        bonuses={selectedRow ? skillBonusesBySkill.get(selectedRow.skill) : undefined}

        onClose={() => setSelectedRow(null)}

      />

    </main>

  );

}

