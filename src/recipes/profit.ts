import type { MarketItemRow } from "../fetcher/types.ts";
import type { SkillBonuses } from "../bonuses/types.ts";
import { DEFAULT_SKILL_BONUSES } from "../bonuses/types.ts";
import { computeEffectiveRecipe } from "./effective-recipe.ts";
import {
  getBuyPrice,
  getSellPrice,
  lookupItem,
  type TradePolicy,
} from "../lib/market-prices.ts";
import type { Recipe, RecipeSecondaryOutput } from "./types.ts";

export const INSTANT_ACTION_TIME_SECONDS = 0.1;
const SECONDS_PER_DAY = 86400;

export interface PricingOptions {
  buyPolicy: TradePolicy;
  sellPolicy: TradePolicy;
}

export interface RecipeProfitOptions extends PricingOptions {
  bonuses?: SkillBonuses;
}

export interface QuantityPerDay {
  item: string;
  quantityPerDay: number;
}

export interface EffectiveIngredientPerAction {
  item: string;
  quantity: number;
}

export interface RecipeProfit {
  ingredientCost: number | null;
  productValue: number | null;
  profit: number | null;
  missingItems: string[];
  effectiveTimeSeconds: number;
  effectiveIngredients: EffectiveIngredientPerAction[];
  effectiveOutputAmount: number;
  effectiveSecondaryOutput: RecipeSecondaryOutput | null;
  isInstant: boolean;
  timingSecondsForRate: number;
  profitPerDay: number | null;
  actionsPerDay: number;
  ingredientsPerDay: QuantityPerDay[];
  outputsPerDay: QuantityPerDay[];
  marketVolumes: Record<string, number | null>;
  marketCapacityRatios: Record<string, number | null>;
  maxMarketCapacityRatio: number | null;
}

interface EffectiveQuantity {
  item: string;
  quantityPerAction: number;
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

export function calculateActionsPerDay(timingSeconds: number): number {
  if (timingSeconds <= 0) return 0;
  return SECONDS_PER_DAY / timingSeconds;
}

export function calculateProfitPerDay(
  profit: number | null,
  timingSeconds: number,
): number | null {
  if (profit === null || timingSeconds <= 0) return null;
  return profit * calculateActionsPerDay(timingSeconds);
}

export function scaleQuantitiesPerDay(
  quantities: EffectiveQuantity[],
  timingSeconds: number,
): QuantityPerDay[] {
  const actionsPerDay = calculateActionsPerDay(timingSeconds);
  return quantities.map(({ item, quantityPerAction }) => ({
    item,
    quantityPerDay: quantityPerAction * actionsPerDay,
  }));
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
  return quantity * getSellPrice(row, options.sellPolicy);
}

function finalizeProfit(
  partial: Omit<
    RecipeProfit,
    | "isInstant"
    | "timingSecondsForRate"
    | "profitPerDay"
    | "actionsPerDay"
    | "ingredientsPerDay"
    | "outputsPerDay"
    | "marketVolumes"
    | "marketCapacityRatios"
    | "maxMarketCapacityRatio"
  >,
  recipe: Recipe,
  effectiveIngredients: EffectiveQuantity[],
  effectiveOutputs: EffectiveQuantity[],
  priceMap: Map<string, MarketItemRow>,
): RecipeProfit {
  const isInstant = isInstantRecipe(recipe);
  const timingSeconds = timingSecondsForRate(
    recipe,
    partial.effectiveTimeSeconds,
  );
  const ingredientsPerDay = scaleQuantitiesPerDay(
    effectiveIngredients,
    timingSeconds,
  );
  const outputsPerDay = scaleQuantitiesPerDay(effectiveOutputs, timingSeconds);

  const marketVolumes: Record<string, number | null> = {};
  const marketCapacityRatios: Record<string, number | null> = {};
  let maxMarketCapacityRatio: number | null = null;

  for (const { item, quantityPerDay } of [
    ...ingredientsPerDay,
    ...outputsPerDay,
  ]) {
    const row = lookupItem(priceMap, item);
    const volume = row?.tradeVolume1Day ?? null;
    marketVolumes[item] = volume;
    if (volume !== null && volume > 0) {
      const ratio = quantityPerDay / volume;
      marketCapacityRatios[item] = ratio;
      if (maxMarketCapacityRatio === null || ratio > maxMarketCapacityRatio) {
        maxMarketCapacityRatio = ratio;
      }
    } else {
      marketCapacityRatios[item] = null;
    }
  }

  return {
    ...partial,
    isInstant,
    timingSecondsForRate: timingSeconds,
    profitPerDay: calculateProfitPerDay(partial.profit, timingSeconds),
    actionsPerDay: calculateActionsPerDay(timingSeconds),
    ingredientsPerDay,
    outputsPerDay,
    marketVolumes,
    marketCapacityRatios,
    maxMarketCapacityRatio,
  };
}

export function calculateRecipeProfit(
  recipe: Recipe,
  priceMap: Map<string, MarketItemRow>,
  options: RecipeProfitOptions,
): RecipeProfit {
  const bonuses = options.bonuses ?? DEFAULT_SKILL_BONUSES;
  const effective = computeEffectiveRecipe(recipe, bonuses, []);
  const effectiveTimeSeconds = effective.time.effective;
  const missingItems: string[] = [];
  let ingredientCost = 0;
  const effectiveIngredients: EffectiveQuantity[] = effective.ingredients.map(
    (ingredient) => ({
      item: ingredient.item,
      quantityPerAction: ingredient.effectiveQty,
    }),
  );

  for (const ingredient of effective.ingredients) {
    const row = lookupItem(priceMap, ingredient.item);
    if (!row) {
      missingItems.push(ingredient.item);
      continue;
    }
    ingredientCost +=
      ingredient.effectiveQty * getBuyPrice(row, options.buyPolicy);
  }

  const primaryOutputAmount = effective.output.effective;
  const effectiveOutputs: EffectiveQuantity[] = [
    { item: recipe.product, quantityPerAction: primaryOutputAmount },
  ];

  const primaryValue = itemSellValue(
    recipe.product,
    primaryOutputAmount,
    priceMap,
    options,
    missingItems,
  );

  let secondaryValue = 0;
  const effectiveSecondary = effective.secondary.effective;
  if (effectiveSecondary) {
    effectiveOutputs.push({
      item: effectiveSecondary.item,
      quantityPerAction: effectiveSecondary.quantity,
    });
    const value = itemSellValue(
      effectiveSecondary.item,
      effectiveSecondary.quantity,
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
          effectiveIngredients: effectiveIngredients.map((entry) => ({
            item: entry.item,
            quantity: entry.quantityPerAction,
          })),
          effectiveOutputAmount: primaryOutputAmount,
          effectiveSecondaryOutput: effectiveSecondary,
        },
        recipe,
        effectiveIngredients,
        effectiveOutputs,
        priceMap,
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
        effectiveIngredients: effectiveIngredients.map((entry) => ({
          item: entry.item,
          quantity: entry.quantityPerAction,
        })),
        effectiveOutputAmount: primaryOutputAmount,
        effectiveSecondaryOutput: effectiveSecondary,
      },
      recipe,
      effectiveIngredients,
      effectiveOutputs,
      priceMap,
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

  const effectiveSnapshot = {
    effectiveIngredients: effectiveIngredients.map((entry) => ({
      item: entry.item,
      quantity: entry.quantityPerAction,
    })),
    effectiveOutputAmount: primaryOutputAmount,
    effectiveSecondaryOutput: effectiveSecondary,
  };

  if (resolvedIngredientCost === null) {
    return finalizeProfit(
      {
        ingredientCost: null,
        productValue,
        profit: null,
        missingItems: [...new Set(missingItems)],
        effectiveTimeSeconds,
        ...effectiveSnapshot,
      },
      recipe,
      effectiveIngredients,
      effectiveOutputs,
      priceMap,
    );
  }

  return finalizeProfit(
    {
      ingredientCost: resolvedIngredientCost,
      productValue,
      profit: productValue - resolvedIngredientCost,
      missingItems: [...new Set(missingItems)],
      effectiveTimeSeconds,
      ...effectiveSnapshot,
    },
    recipe,
    effectiveIngredients,
    effectiveOutputs,
    priceMap,
  );
}
