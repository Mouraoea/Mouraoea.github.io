import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { resolveSkillBonusesWithContributions } from "../bonuses/resolve-bonuses.ts";
import { DEFAULT_SKILL_BONUSES } from "../bonuses/types.ts";
import { BonusValue } from "../components/BonusValue.tsx";
import { PlayerBonusBar } from "../components/PlayerBonusBar.tsx";
import { useAppLocale } from "../components/LanguageSwitcher.tsx";
import { usePlayerBonusContext } from "../hooks/usePlayerBonusContext.ts";
import {
  translateNameId,
  translateSkillGroupLabel,
  translateSkillSlug,
} from "../i18n/game-labels.ts";
import { computeEffectiveRecipe } from "../recipes/effective-recipe.ts";
import { loadSkillRecipes } from "../recipes/parser.ts";
import { isInstantRecipe } from "../recipes/profit.ts";
import { SKILL_GROUPS } from "../recipes/skills.ts";
import { type SkillRecipeFile, type SkillSlug } from "../recipes/types.ts";
import "./RecipesPage.css";

function formatTime(seconds: number): string {
  if (Number.isInteger(seconds)) return `${seconds}s`;
  return `${seconds.toFixed(1)}s`;
}

function formatOutputValue(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function formatIngredients(
  effective: ReturnType<typeof computeEffectiveRecipe>,
  emDash: string,
) {
  if (effective.ingredients.length === 0) return emDash;

  return effective.ingredients.map((ingredient, index) => {
    const label = `${ingredient.effectiveQty}× ${translateNameId(ingredient.item)}`;
    return (
      <span key={ingredient.item}>
        {index > 0 ? ", " : null}
        <BonusValue modified={ingredient.modified} tooltip={ingredient.tooltip}>
          {label}
        </BonusValue>
      </span>
    );
  });
}

function formatSecondaryOutput(
  effective: ReturnType<typeof computeEffectiveRecipe>,
): string {
  const secondary = effective.secondary.effective;
  if (!secondary) return "";
  return `${formatOutputValue(secondary.quantity)}× ${translateNameId(secondary.item)}`;
}

export function RecipesPage() {
  const { t } = useTranslation(["recipes", "common", "profit"]);
  const locale = useAppLocale();
  const playerContext = usePlayerBonusContext();
  const { playerBundle, upgradeCatalog, gearSettings, hasPlayerBonuses } =
    playerContext;

  const [skill, setSkill] = useState<SkillSlug>("smithing");
  const [recipeFile, setRecipeFile] = useState<SkillRecipeFile | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRecipes = useCallback(async (selectedSkill: SkillSlug) => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadSkillRecipes(selectedSkill);
      setRecipeFile(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setRecipeFile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecipes(skill);
  }, [skill, loadRecipes]);

  const resolvedBonuses = useMemo(() => {
    if (!hasPlayerBonuses) return null;
    return resolveSkillBonusesWithContributions(
      skill,
      playerBundle?.profile ?? null,
      playerBundle?.clan ?? null,
      upgradeCatalog,
      gearSettings,
    );
  }, [
    hasPlayerBonuses,
    skill,
    playerBundle,
    upgradeCatalog,
    gearSettings,
  ]);

  const filteredRecipes = useMemo(() => {
    if (!recipeFile) return [];
    const query = search.trim().toLowerCase();
    if (!query) return recipeFile.recipes;

    return recipeFile.recipes.filter((recipe) => {
      const idMatch = recipe.id.toLowerCase().includes(query);
      const nameMatch = translateNameId(recipe.id).toLowerCase().includes(query);
      const productMatch = translateNameId(recipe.product).toLowerCase().includes(query);
      const ingredientMatch = recipe.ingredients.some((ingredient) =>
        translateNameId(ingredient.item).toLowerCase().includes(query) ||
        ingredient.item.toLowerCase().includes(query),
      );
      return idMatch || nameMatch || productMatch || ingredientMatch;
    });
  }, [recipeFile, search, locale]);

  const emDash = t("common:labels.emDash");

  return (
    <main className="page">
      <header className="page-header">
        <h1>{t("recipes:title")}</h1>
      </header>

      <PlayerBonusBar
        context={playerContext}
        bonusSummaryKey="recipes:bonusSummary"
      />

      <section className="control-bar">
        <label className="field">
          {t("common:labels.skill")}
          <select
            value={skill}
            onChange={(e) => setSkill(e.target.value as SkillSlug)}
          >
            {SKILL_GROUPS.map((group) => (
              <optgroup key={group.key} label={translateSkillGroupLabel(group.key)}>
                {group.slugs.map((slug) => (
                  <option key={slug} value={slug}>
                    {translateSkillSlug(slug)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label className="field">
          {t("common:labels.search")}
          <input
            type="search"
            placeholder={t("recipes:searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void loadRecipes(skill)}
          disabled={loading}
        >
          {t("common:actions.refresh")}
        </button>
      </section>

      {loading && <p className="status-text">{t("recipes:loading")}</p>}
      {error && <p className="status-error">{error}</p>}

      {!loading && !error && recipeFile && (
        <>
          {recipeFile.recipes.length === 0 ? (
            <p className="status-text">{t("recipes:noRecipes")}</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table recipes-table">
                <thead>
                  <tr>
                    <th>{t("recipes:table.name")}</th>
                    <th>{t("recipes:table.product")}</th>
                    <th>{t("recipes:table.time")}</th>
                    <th>{t("recipes:table.output")}</th>
                    <th>{t("recipes:table.ingredients")}</th>
                    <th>{t("recipes:table.secondary")}</th>
                    <th>{t("recipes:table.level")}</th>
                    <th>{t("recipes:table.xp")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecipes.map((recipe) => {
                    const effective = resolvedBonuses
                      ? computeEffectiveRecipe(
                          recipe,
                          resolvedBonuses.bonuses,
                          resolvedBonuses.contributions,
                        )
                      : computeEffectiveRecipe(recipe, DEFAULT_SKILL_BONUSES, []);

                    const timeValue = isInstantRecipe(recipe)
                      ? t("common:labels.instant")
                      : formatTime(effective.time.effective);

                    const secondaryText = formatSecondaryOutput(effective);

                    return (
                      <tr key={recipe.id}>
                        <td>{translateNameId(recipe.id)}</td>
                        <td>
                          <code>{translateNameId(recipe.product)}</code>
                        </td>
                        <td>
                          <BonusValue
                            modified={effective.time.modified}
                            tooltip={effective.time.tooltip}
                          >
                            {timeValue}
                          </BonusValue>
                        </td>
                        <td>
                          <BonusValue
                            modified={effective.output.modified}
                            tooltip={effective.output.tooltip}
                          >
                            {formatOutputValue(effective.output.effective)}
                          </BonusValue>
                        </td>
                        <td className="cell-wrap">
                          {formatIngredients(effective, emDash)}
                        </td>
                        <td>
                          {secondaryText ? (
                            <BonusValue
                              modified={effective.secondary.modified}
                              tooltip={effective.secondary.tooltip}
                            >
                              {secondaryText}
                            </BonusValue>
                          ) : (
                            emDash
                          )}
                        </td>
                        <td>{recipe.levelRequired}</td>
                        <td>{recipe.xp}</td>
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
