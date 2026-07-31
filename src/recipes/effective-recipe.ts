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

function globalOutputContributions(
  contributions: BonusContribution[],
): BonusContribution[] {
  return contributions.filter(
    (contribution) =>
      contribution.kind === "output" && !contribution.productMatches,
  );
}

function productOutputContributions(
  contributions: BonusContribution[],
  product: string,
): BonusContribution[] {
  return contributions.filter(
    (contribution) =>
      contribution.kind === "output" &&
      contribution.productMatches !== undefined &&
      contribution.productMatches(product),
  );
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

  const productOutputFactor = bonuses.productOutputMultipliers.reduce(
    (acc, entry) => (entry.matches(recipe.product) ? acc * entry.multiplier : acc),
    1,
  );

  const baseOutput = recipe.outputAmount;
  const effectiveOutput =
    baseOutput * bonuses.outputMultiplier * productOutputFactor;
  const outputModified = effectiveOutput !== baseOutput;

  const baseSecondary = recipe.secondaryOutput;
  let effectiveSecondary = baseSecondary
    ? {
        item: baseSecondary.item,
        quantity: baseSecondary.quantity * bonuses.outputMultiplier,
      }
    : null;
  let secondaryModified =
    baseSecondary !== null &&
    effectiveSecondary !== null &&
    effectiveSecondary.quantity !== baseSecondary.quantity;

  const appliedBonusOutputContributions: BonusContribution[] = [];
  for (const rule of bonuses.bonusOutputs) {
    const item = rule.resolveItem(recipe.product);
    if (!item) continue;

    const matchingContribution =
      contributions.find(
        (contribution) =>
          contribution.kind === "bonusOutput" &&
          contribution.sourceId === rule.sourceId,
      ) ?? {
        sourceId: rule.sourceId,
        label: rule.label,
        kind: "bonusOutput" as const,
        factor: 1,
      };

    if (effectiveSecondary === null) {
      effectiveSecondary = { item, quantity: rule.quantity };
      secondaryModified = true;
      appliedBonusOutputContributions.push(matchingContribution);
    } else if (effectiveSecondary.item === item) {
      effectiveSecondary = {
        item,
        quantity: effectiveSecondary.quantity + rule.quantity,
      };
      secondaryModified = true;
      appliedBonusOutputContributions.push(matchingContribution);
    }
  }

  const speedContributions = relevantSpeedContributions(contributions);
  const globalOutput = globalOutputContributions(contributions);
  const primaryOutputContributions = [
    ...globalOutput,
    ...productOutputContributions(contributions, recipe.product),
  ];
  const secondaryTooltipContributions = [
    ...(baseSecondary ? globalOutput : []),
    ...appliedBonusOutputContributions,
  ];

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
            primaryOutputContributions,
          )
        : null,
    },
    secondary: {
      base: baseSecondary,
      effective: effectiveSecondary,
      modified: secondaryModified,
      tooltip:
        secondaryModified && effectiveSecondary
          ? buildFieldTooltip(
              baseSecondary
                ? formatQuantityLabel(baseSecondary.quantity, baseSecondary.item)
                : i18n.t("recipes:tooltips.none"),
              formatQuantityLabel(
                effectiveSecondary.quantity,
                effectiveSecondary.item,
              ),
              secondaryTooltipContributions,
            )
          : null,
    },
    ingredients,
  };
}
