import { translateNameId } from "../i18n/game-labels.ts";
import { formatCompactNumber } from "./format-compact-number.ts";
import type { QuantityPerDay } from "../recipes/profit.ts";
import type { Recipe } from "../recipes/types.ts";

export function formatEffectiveIngredients(
  ingredients: { item: string; quantity: number }[],
  emDash: string,
): string {
  if (ingredients.length === 0) return emDash;
  return ingredients
    .map(
      (ingredient) =>
        `${formatEffectiveQuantity(ingredient.quantity)}× ${translateNameId(ingredient.item)}`,
    )
    .join(", ");
}

export function formatEffectiveQuantity(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, "");
}

export function formatEffectiveSecondaryOutput(
  secondary: { item: string; quantity: number } | null,
): string {
  if (!secondary) return "";
  return `${formatEffectiveQuantity(secondary.quantity)}× ${translateNameId(secondary.item)}`;
}

export function formatIngredients(recipe: Recipe, emDash: string): string {
  if (recipe.ingredients.length === 0) return emDash;
  return recipe.ingredients
    .map((ingredient) => `${ingredient.quantity}× ${translateNameId(ingredient.item)}`)
    .join(", ");
}

export function formatSecondaryOutput(recipe: Recipe): string {
  if (!recipe.secondaryOutput) return "";
  const { item, quantity } = recipe.secondaryOutput;
  return `${quantity}× ${translateNameId(item)}`;
}

export function formatQuantity(value: number, locale: string): string {
  return formatCompactNumber(value, locale);
}

export function formatQuantitiesPerDay(
  items: QuantityPerDay[],
  locale: string,
  emDash: string,
): string {
  if (items.length === 0) return emDash;
  return items
    .map(
      (entry) =>
        `${formatQuantity(entry.quantityPerDay, locale)}× ${translateNameId(entry.item)}`,
    )
    .join(", ");
}

export function formatRatio(value: number | null, locale: string): string {
  if (value === null) return "—";
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatTime(seconds: number): string {
  if (Number.isInteger(seconds)) return `${seconds}s`;
  return `${seconds.toFixed(1)}s`;
}

export function formatGold(
  value: number | null,
  locale: string,
  emDash: string,
): string {
  if (value === null) return emDash;
  return formatCompactNumber(value, locale);
}

export function profitMoneyClass(value: number | null): string {
  if (value === null) return "profit-money";
  if (value > 0) return "profit-money profit-positive";
  if (value < 0) return "profit-money profit-negative";
  return "profit-money";
}
