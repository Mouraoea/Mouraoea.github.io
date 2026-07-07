import type { RecipeProfit } from "./profit.ts";
import type { Recipe, SkillSlug } from "./types.ts";

export interface RecipeRow {
  skill: SkillSlug;
  recipe: Recipe;
  profit: RecipeProfit;
}
