import {
  SKILL_SLUGS,
  type GameDataArchive,
  type Recipe,
  type SkillRecipeFile,
  type SkillSlug,
} from "./types.ts";
import {
  isSkillSlug,
  validateGameDataArchive,
  validateSkillRecipeFile,
} from "./validate.ts";

const RECIPE_BASE = "/data/recipes";
const GAME_DATA_URL = "/data/game/game-data.json";

export async function loadSkillRecipes(
  skill: SkillSlug,
): Promise<SkillRecipeFile> {
  const response = await fetch(`${RECIPE_BASE}/${skill}.json`);
  if (!response.ok) {
    throw new Error(`Failed to load recipes for ${skill}: HTTP ${response.status}`);
  }

  const parsed: unknown = await response.json();
  const file = validateSkillRecipeFile(parsed);
  if (!file) {
    throw new Error(`Invalid recipe file format for ${skill}`);
  }
  return file;
}

export async function loadAllSkillRecipes(): Promise<
  Record<SkillSlug, SkillRecipeFile>
> {
  const skills = [...SKILL_SLUGS];

  const entries = await Promise.all(
    skills.map(async (skill) => [skill, await loadSkillRecipes(skill)] as const),
  );

  return Object.fromEntries(entries) as Record<SkillSlug, SkillRecipeFile>;
}

export async function loadGameData(): Promise<GameDataArchive> {
  const response = await fetch(GAME_DATA_URL);
  if (!response.ok) {
    throw new Error(`Failed to load game data: HTTP ${response.status}`);
  }

  const parsed: unknown = await response.json();
  const archive = validateGameDataArchive(parsed);
  if (!archive) {
    throw new Error("Invalid game data archive format");
  }
  return archive;
}

export interface RecipeIndexEntry {
  skill: SkillSlug;
  recipe: Recipe;
}

export async function buildRecipeIndex(): Promise<Map<string, RecipeIndexEntry[]>> {
  const all = await loadAllSkillRecipes();
  const index = new Map<string, RecipeIndexEntry[]>();

  for (const [skill, file] of Object.entries(all)) {
    if (!isSkillSlug(skill)) continue;
    for (const recipe of file.recipes) {
      const key = recipe.product;
      const entries = index.get(key) ?? [];
      entries.push({ skill, recipe });
      index.set(key, entries);
    }
  }

  return index;
}
