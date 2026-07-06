import type { MarketItemRow } from "../fetcher/types.ts";
import type { SkillBonuses } from "../bonuses/types.ts";
import { DEFAULT_SKILL_BONUSES } from "../bonuses/types.ts";
import {
  getBuyPrice,
  getSellPrice,
  lookupItem,
} from "../lib/market-prices.ts";
import type { Recipe } from "./types.ts";

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

export function calculateRecipeProfit(
  recipe: Recipe,
  priceMap: Map<string, MarketItemRow>,
  options: RecipeProfitOptions,
): RecipeProfit {
  const bonuses = options.bonuses ?? DEFAULT_SKILL_BONUSES;
  const effectiveTimeSeconds = recipe.baseTimeSeconds / bonuses.speedMultiplier;
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
      return {
        ingredientCost: null,
        productValue: null,
        profit: null,
        missingItems: [...new Set(missingItems)],
        effectiveTimeSeconds,
      };
    }
    secondaryValue = value;
  }

  if (primaryValue === null) {
    return {
      ingredientCost: null,
      productValue: null,
      profit: null,
      missingItems: [...new Set(missingItems)],
      effectiveTimeSeconds,
    };
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
    return {
      ingredientCost: null,
      productValue,
      profit: null,
      missingItems: [...new Set(missingItems)],
      effectiveTimeSeconds,
    };
  }

  return {
    ingredientCost: resolvedIngredientCost,
    productValue,
    profit: productValue - resolvedIngredientCost,
    missingItems: [...new Set(missingItems)],
    effectiveTimeSeconds,
  };
}
