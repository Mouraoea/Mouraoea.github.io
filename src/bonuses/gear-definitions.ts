import type { SkillSlug } from "../recipes/types.ts";
import { SKILL_SLUGS } from "../recipes/types.ts";

export const TOOL_MAX_TIER = 8;
export const CAPE_MAX_TIER = 4;

/** Skilling speed boost per tier (4% … 25%). */
const TOOL_TIER_SPEED_FRACTIONS = [0.04, 0.06, 0.08, 0.1, 0.12, 0.15, 0.2, 0.25];

export function toolSpeedFraction(tier: number): number {
  if (tier <= 0) return 0;
  const clamped = Math.min(TOOL_MAX_TIER, Math.max(1, tier));
  return TOOL_TIER_SPEED_FRACTIONS[clamped - 1]!;
}

export function toolSpeedMultiplier(tier: number): number {
  return 1 + toolSpeedFraction(tier);
}

/** Mastery cape tiers: 5% / 10% / 15% / 20% skilling speed. */
export function capeSpeedFraction(tier: number): number {
  if (tier <= 0) return 0;
  const clamped = Math.min(CAPE_MAX_TIER, Math.max(0, tier));
  return clamped * 0.05;
}

export function capeSpeedMultiplier(tier: number): number {
  return 1 + capeSpeedFraction(tier);
}

/** 2% skilling speed per worn set piece (wiki skilling gear table). */
export const SKILLING_SET_PIECE_SPEED_FRACTION = 0.02;
export const SKILLING_SET_PIECE_SPEED_MULTIPLIER =
  1 + SKILLING_SET_PIECE_SPEED_FRACTION;

export interface SkillingSetPieceDefinition {
  id: "head" | "body" | "legs";
}

/** Expected extra drop when a special tool proc triggers. */
export interface SkillGearBonusOutputDefinition {
  /** Expected quantity per action (e.g. 0.2 for a 20% chance of 1). */
  expectedQuantity: number;
  /** Fixed bonus item, or omit and use resolveItem. */
  item?: string;
  /** Derive bonus item from the recipe product; return null to skip. */
  resolveItem?: (productId: string) => string | null;
  /** When set, only matching products can proc. */
  productMatches?: (productId: string) => boolean;
}

export interface SkillGearToggleDefinition {
  speedMultiplier?: number;
  outputMultiplier?: number;
  /** Multiplier on ingredient quantities (e.g. 0.9 = 10% fewer). */
  inputCostMultiplier?: number;
  /** Extra expected output from a proc chance (lamp, mallet). */
  bonusOutput?: SkillGearBonusOutputDefinition;
}

export interface SkillGearDefinition {
  skill: SkillSlug;
  skillingSetPieces?: SkillingSetPieceDefinition[];
  gloves?: SkillGearToggleDefinition;
  /** Extra boolean gear (e.g. Guardian tools) alongside the tiered tool. */
  specialTool?: SkillGearToggleDefinition;
  tool?: true;
  cape?: true;
}

/** High-tier ores that can proc coal from Guardian's lamp. */
const GUARDIAN_LAMP_ORES = new Set([
  "gold_ore",
  "platinum_ore",
  "meteorite_ore",
  "diamond_ore",
  "titanium_ore",
]);

/** Logs that have a matching plank for Guardian's mallet. */
const GUARDIAN_MALLET_PLANKS = new Set([
  "spruce_plank",
  "pine_plank",
  "oak_plank",
  "maple_plank",
  "teak_plank",
  "chestnut_plank",
  "mahogany_plank",
  "yew_plank",
  "redwood_plank",
  "magical_plank",
]);

function logProductToPlank(productId: string): string | null {
  if (!productId.endsWith("_log")) return null;
  const plank = `${productId.slice(0, -"_log".length)}_plank`;
  return GUARDIAN_MALLET_PLANKS.has(plank) ? plank : null;
}

/** Wiki-sourced skilling gear, gloves, tools, and capes per profit skill. */
export const SKILL_GEAR_DEFINITIONS: SkillGearDefinition[] = [
  {
    skill: "woodcutting",
    skillingSetPieces: [{ id: "head" }, { id: "body" }, { id: "legs" }],
    gloves: { outputMultiplier: 1.05 },
    // Guardian's mallet: 10% chance of a matching plank on top of logs.
    specialTool: {
      bonusOutput: {
        expectedQuantity: 0.1,
        resolveItem: logProductToPlank,
      },
    },
    tool: true,
    cape: true,
  },
  {
    skill: "mining",
    skillingSetPieces: [{ id: "head" }, { id: "body" }, { id: "legs" }],
    gloves: { outputMultiplier: 1.05 },
    // Guardian's lamp: 20% chance of coal when mining high-quality ores.
    specialTool: {
      bonusOutput: {
        expectedQuantity: 0.2,
        item: "coal_ore",
        productMatches: (productId) => GUARDIAN_LAMP_ORES.has(productId),
      },
    },
    tool: true,
    cape: true,
  },
  {
    skill: "fishing",
    skillingSetPieces: [{ id: "head" }, { id: "body" }, { id: "legs" }],
    gloves: { outputMultiplier: 1.05 },
    tool: true,
    cape: true,
  },
  {
    skill: "foraging",
    skillingSetPieces: [{ id: "head" }, { id: "body" }, { id: "legs" }],
    gloves: { outputMultiplier: 1.05 },
    tool: true,
    cape: true,
  },
  {
    skill: "farming",
    gloves: { outputMultiplier: 1.05 },
    // Guardian's trowel: 5% farming skilling speed.
    specialTool: { speedMultiplier: 1.05 },
    tool: true,
    cape: true,
  },
  {
    skill: "carpentry",
    gloves: { outputMultiplier: 1.05 },
    tool: true,
    cape: true,
  },
  {
    skill: "cooking",
    skillingSetPieces: [{ id: "head" }, { id: "body" }, { id: "legs" }],
    gloves: { outputMultiplier: 1.05 },
    tool: true,
    cape: true,
  },
  {
    skill: "crafting",
    skillingSetPieces: [{ id: "head" }, { id: "body" }, { id: "legs" }],
    gloves: { outputMultiplier: 1.05 },
    // Guardian's chisel: +10% gemstone crafting XP (not modeled in profit).
    specialTool: {},
    tool: true,
    cape: true,
  },
  {
    skill: "smithing",
    gloves: { outputMultiplier: 1.05 },
    tool: true,
    cape: true,
  },
  {
    skill: "smelting",
    gloves: { outputMultiplier: 1.05 },
    tool: true,
    cape: true,
  },
  {
    skill: "enchanting",
    cape: true,
  },
  {
    skill: "brewing",
    gloves: { outputMultiplier: 1.05 },
    // Guardian's brewing spoon: 10% fewer ingredients (stacks with Philosopher's stone).
    specialTool: { inputCostMultiplier: 0.9 },
    tool: true,
    cape: true,
  },
  {
    skill: "item_creation",
    gloves: { outputMultiplier: 1.05 },
    cape: true,
  },
];

export const SKILL_GEAR_BY_SLUG = new Map(
  SKILL_GEAR_DEFINITIONS.map((definition) => [definition.skill, definition]),
);

export function gearSkillsInOrder(): SkillSlug[] {
  return SKILL_SLUGS.filter((slug) => SKILL_GEAR_BY_SLUG.has(slug));
}
