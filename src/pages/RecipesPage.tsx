import { useCallback, useEffect, useMemo, useState } from "react";
import { loadSkillRecipes } from "../recipes/parser.ts";
import { formatSkillLabel, SKILL_GROUPS } from "../recipes/skills.ts";
import { type Recipe, type SkillRecipeFile, type SkillSlug } from "../recipes/types.ts";
import "./RecipesPage.css";

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

export function RecipesPage() {
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
      const nameMatch = recipe.displayName.toLowerCase().includes(query);
      const productMatch = recipe.product.toLowerCase().includes(query);
      const ingredientMatch = recipe.ingredients.some((ingredient) =>
        ingredient.item.toLowerCase().includes(query),
      );
      return idMatch || nameMatch || productMatch || ingredientMatch;
    });
  }, [recipeFile, search]);

  return (
    <main className="recipes-page">
      <header className="recipes-header">
        <h1>IdleClans Recipes</h1>
        <p className="recipes-subtitle">
          Crafting and gathering data from <code>public/data/recipes/</code>
        </p>
      </header>

      <section className="recipes-controls">
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
          onClick={() => void loadRecipes(skill)}
          disabled={loading}
        >
          Refresh
        </button>
      </section>

      {loading && <p className="recipes-status">Loading recipes…</p>}
      {error && <p className="recipes-error">{error}</p>}

      {!loading && !error && recipeFile && (
        <>
          <p className="recipes-meta">
            Captured at{" "}
            <time dateTime={recipeFile.capturedAt}>{recipeFile.capturedAt}</time>
            {" · "}
            {filteredRecipes.length} of {recipeFile.recipes.length} recipes
          </p>

          {recipeFile.recipes.length === 0 ? (
            <p className="recipes-status">No recipes for this skill.</p>
          ) : (
            <div className="recipes-table-wrap">
              <table className="recipes-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Product</th>
                    <th>Time</th>
                    <th>Output</th>
                    <th>Ingredients</th>
                    <th>Secondary</th>
                    <th>Level</th>
                    <th>XP</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecipes.map((recipe) => (
                    <tr key={recipe.id}>
                      <td>{recipe.displayName}</td>
                      <td>
                        <code>{recipe.product}</code>
                      </td>
                      <td>{formatTime(recipe.baseTimeSeconds)}</td>
                      <td>{recipe.outputAmount}</td>
                      <td className="recipes-ingredients">
                        {formatIngredients(recipe)}
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
