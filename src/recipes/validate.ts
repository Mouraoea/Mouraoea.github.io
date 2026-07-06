import {
  RECIPE_FILE_VERSION,
  SKILL_SLUGS,
  type GameDataArchive,
  type Recipe,
  type SkillRecipeFile,
  type SkillSlug,
} from "./types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isSkillSlug(value: string): value is SkillSlug {
  return (SKILL_SLUGS as readonly string[]).includes(value);
}

/** @deprecated Use isSkillSlug */
export const isCraftSkillSlug = isSkillSlug;

export function validateRecipe(value: unknown): Recipe | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string") return null;
  if (typeof value.displayName !== "string") return null;
  if (typeof value.product !== "string") return null;
  if (typeof value.baseTimeSeconds !== "number") return null;
  if (typeof value.outputAmount !== "number") return null;
  if (typeof value.levelRequired !== "number") return null;
  if (typeof value.xp !== "number") return null;
  if (!Array.isArray(value.ingredients)) return null;

  for (const ingredient of value.ingredients) {
    if (!isRecord(ingredient)) return null;
    if (typeof ingredient.item !== "string") return null;
    if (typeof ingredient.quantity !== "number") return null;
  }

  if (value.secondaryOutput !== null && value.secondaryOutput !== undefined) {
    if (!isRecord(value.secondaryOutput)) return null;
    if (typeof value.secondaryOutput.item !== "string") return null;
    if (typeof value.secondaryOutput.quantity !== "number") return null;
  } else if (value.secondaryOutput !== null) {
    return null;
  }

  return {
    id: value.id,
    displayName: value.displayName,
    product: value.product,
    baseTimeSeconds: value.baseTimeSeconds,
    outputAmount: value.outputAmount,
    secondaryOutput: value.secondaryOutput as Recipe["secondaryOutput"],
    ingredients: value.ingredients as Recipe["ingredients"],
    levelRequired: value.levelRequired,
    xp: value.xp,
    bonuses: isRecord(value.bonuses)
      ? (value.bonuses as Recipe["bonuses"])
      : undefined,
  };
}

export function validateSkillRecipeFile(value: unknown): SkillRecipeFile | null {
  if (!isRecord(value)) return null;
  if (typeof value.skill !== "string" || !isSkillSlug(value.skill)) return null;
  if (value.version !== RECIPE_FILE_VERSION) return null;
  if (value.source !== "official-game-data") return null;
  if (typeof value.capturedAt !== "string") return null;
  if (!Array.isArray(value.recipes)) return null;

  const recipes: Recipe[] = [];
  for (const recipe of value.recipes) {
    const validated = validateRecipe(recipe);
    if (!validated) return null;
    recipes.push(validated);
  }

  return {
    skill: value.skill,
    version: RECIPE_FILE_VERSION,
    source: "official-game-data",
    capturedAt: value.capturedAt,
    recipes,
  };
}

export function validateGameDataArchive(value: unknown): GameDataArchive | null {
  if (!isRecord(value)) return null;
  if (value.version !== 1) return null;
  if (typeof value.capturedAt !== "string") return null;
  if (!isRecord(value.data)) return null;
  return {
    version: 1,
    capturedAt: value.capturedAt,
    data: value.data,
  };
}
