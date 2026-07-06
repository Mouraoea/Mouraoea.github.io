import type { MarketItemRow } from "../fetcher/types.ts";
import type { SkillBonuses } from "../bonuses/types.ts";
import { DEFAULT_SKILL_BONUSES } from "../bonuses/types.ts";
import {
  getBuyPrice,
  getSellPrice,
  lookupItem,
} from "../lib/market-prices.ts";
import type { Recipe } from "./types.ts";

export const INSTANT_ACTION_TIME_SECONDS = 0.1;
const SECONDS_PER_DAY = 86400;

export interface PricingOptions {
  instantBuy: boolean;
  instantSell: boolean;
}

export interface RecipeProfitOptions extends PricingOptions {
  bonuses?: SkillBonuses;
}

export interface RecipeProfit {
  ingredientCost: number | null;
  productValue: number | null;
  profit: number | null;
  missingItems: string[];
  effectiveTimeSeconds: number;
  isInstant: boolean;
  timingSecondsForRate: number;
  profitPerDay: number | null;
}

export function isInstantRecipe(recipe: Recipe): boolean {
  return recipe.baseTimeSeconds === 0;
}

export function timingSecondsForRate(
  recipe: Recipe,
  effectiveTimeSeconds: number,
): number {
  if (isInstantRecipe(recipe)) {
    return INSTANT_ACTION_TIME_SECONDS;
  }
  return effectiveTimeSeconds > 0 ? effectiveTimeSeconds : INSTANT_ACTION_TIME_SECONDS;
}

export function calculateProfitPerDay(
  profit: number | null,
  timingSeconds: number,
): number | null {
  if (profit === null || timingSeconds <= 0) return null;
  return profit * (SECONDS_PER_DAY / timingSeconds);
}

function itemSellValue(
  nameId: string,
  quantity: number,
  priceMap: Map<string, MarketItemRow>,
  options: PricingOptions,
  missingItems: string[],
): number | null {
  const row = lookupItem(priceMap, nameId);
  if (!row) {
    missingItems.push(nameId);
    return null;
  }
  return quantity * getSellPrice(row, options.instantSell);
}

function finalizeProfit(
  partial: Omit<RecipeProfit, "isInstant" | "timingSecondsForRate" | "profitPerDay">,
  recipe: Recipe,
): RecipeProfit {
  const isInstant = isInstantRecipe(recipe);
  const timingSeconds = timingSecondsForRate(
    recipe,
    partial.effectiveTimeSeconds,
  );
  return {
    ...partial,
    isInstant,
    timingSecondsForRate: timingSeconds,
    profitPerDay: calculateProfitPerDay(partial.profit, timingSeconds),
  };
}

export function calculateRecipeProfit(
  recipe: Recipe,
  priceMap: Map<string, MarketItemRow>,
  options: RecipeProfitOptions,
): RecipeProfit {
  const bonuses = options.bonuses ?? DEFAULT_SKILL_BONUSES;
  const effectiveTimeSeconds = isInstantRecipe(recipe)
    ? 0
    : recipe.baseTimeSeconds / bonuses.speedMultiplier;
  const missingItems: string[] = [];
  let ingredientCost = 0;

  for (const ingredient of recipe.ingredients) {
    const row = lookupItem(priceMap, ingredient.item);
    if (!row) {
      missingItems.push(ingredient.item);
      continue;
    }
    const effectiveQuantity = Math.ceil(
      ingredient.quantity * bonuses.inputCostMultiplier,
    );
    ingredientCost += effectiveQuantity * getBuyPrice(row, options.instantBuy);
  }

  const primaryOutputAmount = recipe.outputAmount * bonuses.outputMultiplier;

  const primaryValue = itemSellValue(
    recipe.product,
    primaryOutputAmount,
    priceMap,
    options,
    missingItems,
  );

  let secondaryValue = 0;
  if (recipe.secondaryOutput) {
    const secondaryAmount =
      recipe.secondaryOutput.quantity * bonuses.outputMultiplier;
    const value = itemSellValue(
      recipe.secondaryOutput.item,
      secondaryAmount,
      priceMap,
      options,
      missingItems,
    );
    if (value === null) {
      return finalizeProfit(
        {
          ingredientCost: null,
          productValue: null,
          profit: null,
          missingItems: [...new Set(missingItems)],
          effectiveTimeSeconds,
        },
        recipe,
      );
    }
    secondaryValue = value;
  }

  if (primaryValue === null) {
    return finalizeProfit(
      {
        ingredientCost: null,
        productValue: null,
        profit: null,
        missingItems: [...new Set(missingItems)],
        effectiveTimeSeconds,
      },
      recipe,
    );
  }

  const hasIngredientGap =
    recipe.ingredients.length > 0 &&
    missingItems.some((item) =>
      recipe.ingredients.some((ingredient) => ingredient.item === item),
    );

  const productValue = primaryValue + secondaryValue;
  const resolvedIngredientCost =
    recipe.ingredients.length === 0 ? 0 : hasIngredientGap ? null : ingredientCost;

  if (resolvedIngredientCost === null) {
    return finalizeProfit(
      {
        ingredientCost: null,
        productValue,
        profit: null,
        missingItems: [...new Set(missingItems)],
        effectiveTimeSeconds,
      },
      recipe,
    );
  }

  return finalizeProfit(
    {
      ingredientCost: resolvedIngredientCost,
      productValue,
      profit: productValue - resolvedIngredientCost,
      missingItems: [...new Set(missingItems)],
      effectiveTimeSeconds,
    },
    recipe,
  );
}
