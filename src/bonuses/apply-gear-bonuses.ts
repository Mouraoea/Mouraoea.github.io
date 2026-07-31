import type { SkillSlug } from "../recipes/types.ts";
import i18n from "../i18n/index.ts";
import { translateGearToggleLabel } from "../i18n/game-labels.ts";
import {
  translateGearCape,
  translateGearGloves,
  translateGearSetPiece,
  translateGearTool,
  translateJewelryEnchant,
} from "../i18n/upgrade-labels.ts";
import type { SkillGearToggleDefinition } from "./gear-definitions.ts";
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

function applyGearToggle(
  bonuses: SkillBonuses,
  contributions: BonusContribution[],
  definition: SkillGearToggleDefinition,
  sourceId: string,
  label: string,
): void {
  if (definition.outputMultiplier) {
    bonuses.outputMultiplier *= definition.outputMultiplier;
    contributions.push({
      sourceId,
      label,
      kind: "output",
      factor: definition.outputMultiplier,
    });
  }

  if (definition.inputCostMultiplier) {
    bonuses.inputCostMultiplier *= definition.inputCostMultiplier;
    contributions.push({
      sourceId,
      label,
      kind: "input",
      factor: definition.inputCostMultiplier,
    });
  }

  if (definition.speedMultiplier && definition.speedMultiplier !== 1) {
    const fraction = definition.speedMultiplier - 1;
    addSkillingSpeedFraction(bonuses, fraction);
    contributions.push({
      sourceId,
      label,
      kind: "speed",
      factor: definition.speedMultiplier,
    });
  }

  if (definition.bonusOutput) {
    const bonus = definition.bonusOutput;
    const resolveItem = (productId: string): string | null => {
      if (bonus.productMatches && !bonus.productMatches(productId)) {
        return null;
      }
      if (bonus.resolveItem) {
        return bonus.resolveItem(productId);
      }
      return bonus.item ?? null;
    };

    bonuses.bonusOutputs.push({
      sourceId,
      label,
      quantity: bonus.expectedQuantity,
      resolveItem,
    });
    contributions.push({
      sourceId,
      label,
      kind: "bonusOutput",
      factor: 1,
    });
  }
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
    applyGearToggle(
      bonuses,
      contributions,
      definition.gloves,
      "gear:gloves",
      translateGearGloves(skill),
    );
  }

  if (definition.specialTool && loadout.specialTool) {
    applyGearToggle(
      bonuses,
      contributions,
      definition.specialTool,
      "gear:specialTool",
      translateGearToggleLabel(skill, "specialTool"),
    );
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
