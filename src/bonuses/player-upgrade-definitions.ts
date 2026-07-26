import type { SkillSlug } from "../recipes/types.ts";
import type { PlayerUpgradeDefinition } from "./types.ts";

/** Arrow crafter raises all crafted arrow quantities (product ids end in `_arrow`). */
export function isArrowProduct(productId: string): boolean {
  return productId.endsWith("_arrow");
}

function doubleChanceOutput(perTier: number) {
  return (tier: number) => 1 + tier * perTier;
}

function saveChanceInput(perTier: number) {
  return (tier: number) => 1 - tier * perTier;
}

function plankBargainGoldMultiplier(tier: number): number {
  if (tier >= 3) return 0;
  if (tier === 2) return 0.4;
  if (tier === 1) return 0.7;
  return 1;
}

/** Wiki-sourced player local market upgrade effects keyed by API field names. */
export const PLAYER_UPGRADE_DEFINITIONS: PlayerUpgradeDefinition[] = [
  {
    apiKey: "theLumberjack",
    skills: ["woodcutting"],
    effects: [
      { kind: "output", multiplierAtTier: doubleChanceOutput(0.2) },
    ],
  },
  {
    apiKey: "theFisherman",
    skills: ["fishing"],
    effects: [
      { kind: "output", multiplierAtTier: doubleChanceOutput(0.2) },
    ],
  },
  {
    apiKey: "powerForager",
    skills: ["foraging"],
    effects: [
      { kind: "output", multiplierAtTier: doubleChanceOutput(0.1) },
    ],
  },
  {
    apiKey: "farmingTrickery",
    skills: ["farming"],
    effects: [
      { kind: "input", multiplierAtTier: saveChanceInput(0.1) },
    ],
  },
  {
    apiKey: "smeltingMagic",
    skills: ["smelting"],
    effects: [
      { kind: "input", multiplierAtTier: saveChanceInput(0.1) },
    ],
  },
  {
    apiKey: "delicateManufacturing",
    skills: ["crafting"],
    effects: [{ kind: "input", multiplierAtTier: () => 0.8 }],
  },
  {
    apiKey: "plankBargain",
    skills: ["carpentry"],
    effects: [
      {
        kind: "input",
        items: ["gold"],
        multiplierAtTier: plankBargainGoldMultiplier,
      },
    ],
  },
  {
    // Local market → Upgrade dealership: permanently +10% crafted arrow output.
    apiKey: "arrowCrafter",
    skills: ["crafting"],
    maxTier: 1,
    manualToggle: true,
    effects: [
      {
        kind: "output",
        multiplierAtTier: () => 1.1,
        productMatches: isArrowProduct,
      },
    ],
  },
];

export const PLAYER_UPGRADE_BY_KEY = new Map(
  PLAYER_UPGRADE_DEFINITIONS.map((definition) => [
    definition.apiKey,
    definition,
  ]),
);

/** Single-purchase local-market perks that can be toggled manually per skill. */
export const MANUAL_LOADOUT_UPGRADES: PlayerUpgradeDefinition[] =
  PLAYER_UPGRADE_DEFINITIONS.filter((definition) => definition.manualToggle);

export function manualLoadoutUpgradesForSkill(
  skill: SkillSlug,
): PlayerUpgradeDefinition[] {
  return MANUAL_LOADOUT_UPGRADES.filter((definition) =>
    definition.skills.includes(skill),
  );
}
