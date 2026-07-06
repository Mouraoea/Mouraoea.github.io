export const RECIPE_FILE_VERSION = 1 as const;

export const CRAFT_SKILL_SLUGS = [
  "carpentry",
  "smelting",
  "smithing",
  "cooking",
  "crafting",
  "enchanting",
  "brewing",
  "item_creation",
] as const;

export const GATHERING_SKILL_SLUGS = [
  "mining",
  "woodcutting",
  "fishing",
  "foraging",
  "farming",
] as const;

export const SKILL_SLUGS = [
  ...CRAFT_SKILL_SLUGS,
  ...GATHERING_SKILL_SLUGS,
] as const;

export type CraftSkillSlug = (typeof CRAFT_SKILL_SLUGS)[number];
export type GatheringSkillSlug = (typeof GATHERING_SKILL_SLUGS)[number];
export type SkillSlug = (typeof SKILL_SLUGS)[number];

export interface RecipeIngredient {
  item: string;
  quantity: number;
}

export interface RecipeSecondaryOutput {
  item: string;
  quantity: number;
}

/** @deprecated Use SkillBonuses from bonuses/types.ts */
export interface RecipeBonuses {
  speedMultiplier?: number;
  inputCostMultiplier?: number;
  outputMultiplier?: number;
}

export type { SkillBonuses } from "../bonuses/types.ts";

export interface Recipe {
  id: string;
  displayName: string;
  product: string;
  baseTimeSeconds: number;
  outputAmount: number;
  secondaryOutput: RecipeSecondaryOutput | null;
  ingredients: RecipeIngredient[];
  levelRequired: number;
  xp: number;
  bonuses?: RecipeBonuses;
}

export interface SkillRecipeFile {
  skill: SkillSlug;
  version: typeof RECIPE_FILE_VERSION;
  source: "official-game-data";
  capturedAt: string;
  recipes: Recipe[];
}

export interface GameDataArchive {
  version: 1;
  capturedAt: string;
  data: Record<string, unknown>;
}

export interface GameTaskCost {
  Item: number;
  Amount: number;
}

export interface GameTask {
  Name: string;
  BaseTime: number;
  Costs?: GameTaskCost[];
  ItemReward: number;
  ItemAmount: number;
  LevelRequirement: number;
  ExpReward: number;
  Disabled?: boolean;
  Hidden?: boolean;
  SecondaryItemReward?: number;
  SecondaryItemAmount?: number;
}
