import type { SkillSlug } from "../recipes/types.ts";
import {
  capeSpeedFraction,
  SKILL_GEAR_BY_SLUG,
  SKILLING_SET_PIECE_SPEED_FRACTION,
  toolSpeedFraction,
} from "./gear-definitions.ts";
import type { SkillGearLoadout } from "./gear-settings.ts";
import { parseJewelryEnchantmentSpeedPercent } from "./gear-settings.ts";
import { addSkillingSpeedFraction } from "./speed-bonuses.ts";
import type { SkillBonuses } from "./types.ts";

export function applyManualGearBonuses(
  bonuses: SkillBonuses,
  skill: SkillSlug,
  loadout: SkillGearLoadout,
): void {
  const definition = SKILL_GEAR_BY_SLUG.get(skill);
  if (!definition) return;

  if (definition.skillingSetPieces) {
    for (const piece of definition.skillingSetPieces) {
      if (loadout.setPieces[piece.id]) {
        addSkillingSpeedFraction(bonuses, SKILLING_SET_PIECE_SPEED_FRACTION);
      }
    }
  }

  if (definition.gloves && loadout.gloves) {
    const mult = definition.gloves.outputMultiplier;
    if (mult) bonuses.outputMultiplier *= mult;
  }

  if (definition.tool && loadout.toolTier > 0) {
    addSkillingSpeedFraction(bonuses, toolSpeedFraction(loadout.toolTier));
  }

  if (definition.cape && loadout.capeTier > 0) {
    addSkillingSpeedFraction(bonuses, capeSpeedFraction(loadout.capeTier));
  }

  const enchantSpeedPercent = parseJewelryEnchantmentSpeedPercent(
    loadout.jewelryEnchantmentSpeed,
  );
  if (enchantSpeedPercent > 0) {
    addSkillingSpeedFraction(bonuses, enchantSpeedPercent / 100);
  }
}
