import type { SkillSlug } from "../recipes/types.ts";
import {
  capeSpeedMultiplier,
  SKILL_GEAR_BY_SLUG,
  SKILLING_SET_PIECE_SPEED_MULTIPLIER,
  toolSpeedMultiplier,
} from "./gear-definitions.ts";
import type { SkillGearLoadout } from "./gear-settings.ts";
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
        bonuses.speedMultiplier *= SKILLING_SET_PIECE_SPEED_MULTIPLIER;
      }
    }
  }

  if (definition.gloves && loadout.gloves) {
    const mult = definition.gloves.outputMultiplier;
    if (mult) bonuses.outputMultiplier *= mult;
  }

  if (definition.tool && loadout.toolTier > 0) {
    bonuses.speedMultiplier *= toolSpeedMultiplier(loadout.toolTier);
  }

  if (definition.cape && loadout.capeTier > 0) {
    bonuses.speedMultiplier *= capeSpeedMultiplier(loadout.capeTier);
  }
}
