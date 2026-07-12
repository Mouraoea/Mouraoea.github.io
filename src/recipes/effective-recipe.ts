import type { BonusContribution, SkillBonuses } from "../bonuses/types.ts";
import { effectiveTaskTimeSeconds } from "../bonuses/speed-bonuses.ts";
import { translateNameId } from "../i18n/game-labels.ts";
import i18n from "../i18n/index.ts";
import { effectiveIngredientQuantity } from "./ingredient-quantity.ts";
import { isInstantRecipe } from "./profit.ts";
import type { Recipe } from "./types.ts";

export interface ModifiedField<T> {
  base: T;
  effective: T;
  modified: boolean;
  tooltip: string | null;
}

export interface EffectiveIngredient {
  item: string;
  baseQty: number;
  effectiveQty: number;
  modified: boolean;
  tooltip: string | null;
}

export interface EffectiveRecipe {
  time: ModifiedField<number>;
  output: ModifiedField<number>;
  secondary: ModifiedField<{ item: string; quantity: number } | null>;
  ingredients: EffectiveIngredient[];
}

function formatQuantityLabel(quantity: number, item: string): string {
  return `${quantity}× ${translateNameId(item)}`;
}

function contributionAppliesToIngredient(
  contribution: BonusContribution,
  item: string,
): boolean {
  if (contribution.kind === "goldInput") {
    return item === "gold";
  }
  if (contribution.kind === "input") {
    return item !== "gold";
  }
  return false;
}

function buildFieldTooltip(
  baseLabel: string,
  effectiveLabel: string,
  contributions: BonusContribution[],
): string | null {
  if (contributions.length === 0) return null;

  const lines = [
    i18n.t("recipes:tooltips.wasValue", { value: baseLabel }),
    ...contributions.map((contribution) =>
      i18n.t("recipes:tooltips.bonusDueTo", { source: contribution.label }),
    ),
  ];

  if (baseLabel !== effectiveLabel) {
    lines.unshift(
      i18n.t("recipes:tooltips.nowValue", { value: effectiveLabel }),
    );
  }

  return lines.join("\n");
}

function buildIngredientTooltip(
  ingredient: { item: string; quantity: number },
  effectiveQty: number,
  contributions: BonusContribution[],
): string | null {
  if (contributions.length === 0) return null;

  const baseLabel = formatQuantityLabel(ingredient.quantity, ingredient.item);
  const effectiveLabel = formatQuantityLabel(effectiveQty, ingredient.item);
  return buildFieldTooltip(baseLabel, effectiveLabel, contributions);
}

function relevantSpeedContributions(
  contributions: BonusContribution[],
): BonusContribution[] {
  return contributions.filter((contribution) => contribution.kind === "speed");
}

function relevantOutputContributions(
  contributions: BonusContribution[],
): BonusContribution[] {
  return contributions.filter((contribution) => contribution.kind === "output");
}

function relevantIngredientContributions(
  contributions: BonusContribution[],
  item: string,
): BonusContribution[] {
  return contributions.filter((contribution) =>
    contributionAppliesToIngredient(contribution, item),
  );
}

function formatTime(seconds: number): string {
  if (Number.isInteger(seconds)) return `${seconds}s`;
  return `${seconds.toFixed(1)}s`;
}

function formatOutputValue(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, "");
}

export function computeEffectiveRecipe(
  recipe: Recipe,
  bonuses: SkillBonuses,
  contributions: BonusContribution[],
): EffectiveRecipe {
  const baseTime = recipe.baseTimeSeconds;
  const effectiveTime = isInstantRecipe(recipe)
    ? 0
    : effectiveTaskTimeSeconds(baseTime, bonuses);
  const timeModified = !isInstantRecipe(recipe) && effectiveTime !== baseTime;

  const baseOutput = recipe.outputAmount;
  const effectiveOutput = baseOutput * bonuses.outputMultiplier;
  const outputModified = effectiveOutput !== baseOutput;

  const baseSecondary = recipe.secondaryOutput;
  const effectiveSecondary = baseSecondary
    ? {
        item: baseSecondary.item,
        quantity: baseSecondary.quantity * bonuses.outputMultiplier,
      }
    : null;
  const secondaryModified =
    baseSecondary !== null &&
    effectiveSecondary !== null &&
    effectiveSecondary.quantity !== baseSecondary.quantity;

  const speedContributions = relevantSpeedContributions(contributions);
  const outputContributions = relevantOutputContributions(contributions);

  const ingredients: EffectiveIngredient[] = recipe.ingredients.map((ingredient) => {
    const effectiveQty = effectiveIngredientQuantity(
      ingredient.item,
      ingredient.quantity,
      bonuses,
    );
    const modified = effectiveQty !== ingredient.quantity;
    const ingredientContributions = relevantIngredientContributions(
      contributions,
      ingredient.item,
    );

    return {
      item: ingredient.item,
      baseQty: ingredient.quantity,
      effectiveQty,
      modified,
      tooltip: modified
        ? buildIngredientTooltip(ingredient, effectiveQty, ingredientContributions)
        : null,
    };
  });

  return {
    time: {
      base: baseTime,
      effective: effectiveTime,
      modified: timeModified,
      tooltip: timeModified
        ? buildFieldTooltip(
            formatTime(baseTime),
            formatTime(effectiveTime),
            speedContributions,
          )
        : null,
    },
    output: {
      base: baseOutput,
      effective: effectiveOutput,
      modified: outputModified,
      tooltip: outputModified
        ? buildFieldTooltip(
            formatOutputValue(baseOutput),
            formatOutputValue(effectiveOutput),
            outputContributions,
          )
        : null,
    },
    secondary: {
      base: baseSecondary,
      effective: effectiveSecondary,
      modified: secondaryModified,
      tooltip:
        secondaryModified && baseSecondary && effectiveSecondary
          ? buildFieldTooltip(
              formatQuantityLabel(baseSecondary.quantity, baseSecondary.item),
              formatQuantityLabel(
                effectiveSecondary.quantity,
                effectiveSecondary.item,
              ),
              outputContributions,
            )
          : null,
    },
    ingredients,
  };
}
