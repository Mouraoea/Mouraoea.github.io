import type { SkillSlug } from "../recipes/types.ts";
import i18n from "../i18n/index.ts";
import {
  translateGearCape,
  translateGearGloves,
  translateGearSetPiece,
  translateGearTool,
  translateJewelryEnchant,
} from "../i18n/upgrade-labels.ts";
import {
  capeSpeedFraction,
  SKILL_GEAR_BY_SLUG,
  SKILLING_SET_PIECE_SPEED_FRACTION,
  toolSpeedFraction,
} from "./gear-definitions.ts";
import type { SkillGearLoadout } from "./gear-settings.ts";
import { parseJewelryEnchantmentSpeedPercent } from "./gear-settings.ts";
import { addSkillingSpeedFraction } from "./speed-bonuses.ts";
import type { BonusContribution, SkillBonuses } from "./types.ts";

function gearSetPieceLabel(skill: SkillSlug, pieceId: "head" | "body" | "legs"): string {
  const key = `gear:gear.${skill}.setPieces.${pieceId}`;
  if (i18n.exists(key)) {
    return i18n.t(key);
  }
  return pieceId;
}

export function applyManualGearBonuses(
  bonuses: SkillBonuses,
  skill: SkillSlug,
  loadout: SkillGearLoadout,
  contributions: BonusContribution[] = [],
): void {
  const definition = SKILL_GEAR_BY_SLUG.get(skill);
  if (!definition) return;

  if (definition.skillingSetPieces) {
    for (const piece of definition.skillingSetPieces) {
      if (loadout.setPieces[piece.id]) {
        addSkillingSpeedFraction(bonuses, SKILLING_SET_PIECE_SPEED_FRACTION);
        contributions.push({
          sourceId: `gear:set:${piece.id}`,
          label: translateGearSetPiece(gearSetPieceLabel(skill, piece.id)),
          kind: "speed",
          factor: 1 + SKILLING_SET_PIECE_SPEED_FRACTION,
        });
      }
    }
  }

  if (definition.gloves && loadout.gloves) {
    const mult = definition.gloves.outputMultiplier;
    if (mult) {
      bonuses.outputMultiplier *= mult;
      contributions.push({
        sourceId: "gear:gloves",
        label: translateGearGloves(skill),
        kind: "output",
        factor: mult,
      });
    }
  }

  if (definition.tool && loadout.toolTier > 0) {
    const fraction = toolSpeedFraction(loadout.toolTier);
    addSkillingSpeedFraction(bonuses, fraction);
    contributions.push({
      sourceId: `gear:tool:${loadout.toolTier}`,
      label: translateGearTool(loadout.toolTier),
      kind: "speed",
      factor: 1 + fraction,
    });
  }

  if (definition.cape && loadout.capeTier > 0) {
    const fraction = capeSpeedFraction(loadout.capeTier);
    addSkillingSpeedFraction(bonuses, fraction);
    contributions.push({
      sourceId: `gear:cape:${loadout.capeTier}`,
      label: translateGearCape(loadout.capeTier),
      kind: "speed",
      factor: 1 + fraction,
    });
  }

  const enchantSpeedPercent = parseJewelryEnchantmentSpeedPercent(
    loadout.jewelryEnchantmentSpeed,
  );
  if (enchantSpeedPercent > 0) {
    const fraction = enchantSpeedPercent / 100;
    addSkillingSpeedFraction(bonuses, fraction);
    contributions.push({
      sourceId: "gear:jewelry",
      label: translateJewelryEnchant(),
      kind: "speed",
      factor: 1 + fraction,
    });
  }
}
