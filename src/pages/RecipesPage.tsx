import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppLocale } from "../components/LanguageSwitcher.tsx";
import {
  translateNameId,
  translateSkillGroupLabel,
  translateSkillSlug,
} from "../i18n/game-labels.ts";
import { loadSkillRecipes } from "../recipes/parser.ts";
import { SKILL_GROUPS } from "../recipes/skills.ts";
import { type Recipe, type SkillRecipeFile, type SkillSlug } from "../recipes/types.ts";
import "./RecipesPage.css";

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

function formatTime(seconds: number): string {
  if (Number.isInteger(seconds)) return `${seconds}s`;
  return `${seconds.toFixed(1)}s`;
}

export function RecipesPage() {
  const { t } = useTranslation(["recipes", "common"]);
  const locale = useAppLocale();
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
                  {filteredRecipes.map((recipe) => (
                    <tr key={recipe.id}>
                      <td>{translateNameId(recipe.id)}</td>
                      <td>
                        <code>{translateNameId(recipe.product)}</code>
                      </td>
                      <td>{formatTime(recipe.baseTimeSeconds)}</td>
                      <td>{recipe.outputAmount}</td>
                      <td className="cell-wrap">
                        {formatIngredients(recipe, emDash)}
                      </td>
                      <td>{formatSecondaryOutput(recipe)}</td>
                      <td>{recipe.levelRequired}</td>
                      <td>{recipe.xp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </main>
  );
}
