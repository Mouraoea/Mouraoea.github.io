import type { PlayerUpgradeDefinition } from "./types.ts";

function doubleChanceOutput(perTier: number) {
  return (tier: number) => 1 + tier * perTier;
}

function saveChanceInput(perTier: number) {
  return (tier: number) => 1 - tier * perTier;
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
];

export const PLAYER_UPGRADE_BY_KEY = new Map(
  PLAYER_UPGRADE_DEFINITIONS.map((definition) => [
    definition.apiKey,
    definition,
  ]),
);
