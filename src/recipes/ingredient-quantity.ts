import type { SkillBonuses } from "../bonuses/types.ts";

export function ingredientCostMultiplier(
  item: string,
  bonuses: SkillBonuses,
): number {
  if (item === "gold") {
    return bonuses.goldInputCostMultiplier;
  }
  return bonuses.inputCostMultiplier;
}

export function effectiveIngredientQuantity(
  item: string,
  baseQuantity: number,
  bonuses: SkillBonuses,
): number {
  return Math.ceil(baseQuantity * ingredientCostMultiplier(item, bonuses));
}
