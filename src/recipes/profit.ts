import type { MarketItemRow } from "../fetcher/types.ts";
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

export interface RecipeProfit {
  ingredientCost: number | null;
  productValue: number | null;
  profit: number | null;
  missingItems: string[];
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
  options: PricingOptions,
): RecipeProfit {
  const missingItems: string[] = [];
  let ingredientCost = 0;

  for (const ingredient of recipe.ingredients) {
    const row = lookupItem(priceMap, ingredient.item);
    if (!row) {
      missingItems.push(ingredient.item);
      continue;
    }
    ingredientCost += ingredient.quantity * getBuyPrice(row, options.instantBuy);
  }

  const primaryValue = itemSellValue(
    recipe.product,
    recipe.outputAmount,
    priceMap,
    options,
    missingItems,
  );

  let secondaryValue = 0;
  if (recipe.secondaryOutput) {
    const value = itemSellValue(
      recipe.secondaryOutput.item,
      recipe.secondaryOutput.quantity,
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
    };
  }

  return {
    ingredientCost: resolvedIngredientCost,
    productValue,
    profit: productValue - resolvedIngredientCost,
    missingItems: [...new Set(missingItems)],
  };
}
