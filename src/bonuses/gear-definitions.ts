import type { SkillSlug } from "../recipes/types.ts";
import { SKILL_SLUGS } from "../recipes/types.ts";

export const TOOL_MAX_TIER = 8;
export const CAPE_MAX_TIER = 4;

/** Tool quality tiers (wiki Tools table): Normal → Otherworldly. */
export const TOOL_TIER_NAMES = [
  "Normal",
  "Refined",
  "Great",
  "Elite",
  "Superior",
  "Outstanding",
  "Godlike",
  "Otherworldly",
] as const;

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

export function formatToolTierOption(
  tier: number,
  toolLabel: string,
): string {
  if (tier <= 0) return "None";
  const name = TOOL_TIER_NAMES[tier - 1];
  if (!name) return "None";
  return `${name} ${toolLabel}`;
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
  label: string;
}

export interface SkillGearToggleDefinition {
  label: string;
  speedMultiplier?: number;
  outputMultiplier?: number;
}

export interface SkillGearDefinition {
  skill: SkillSlug;
  skillingSetPieces?: SkillingSetPieceDefinition[];
  gloves?: SkillGearToggleDefinition;
  tool?: { label: string };
  cape?: { label: string };
}

/** Wiki-sourced skilling gear, gloves, tools, and capes per profit skill. */
export const SKILL_GEAR_DEFINITIONS: SkillGearDefinition[] = [
  {
    skill: "woodcutting",
    skillingSetPieces: [
      { id: "head", label: "Lumberjack's hat" },
      { id: "body", label: "Lumberjack's shirt" },
      { id: "legs", label: "Lumberjack's pants" },
    ],
    gloves: { label: "Woodcutting gloves", outputMultiplier: 1.05 },
    tool: { label: "Hatchet" },
    cape: { label: "Woodcutting cape" },
  },
  {
    skill: "mining",
    skillingSetPieces: [
      { id: "head", label: "Miner's helmet" },
      { id: "body", label: "Miner's jacket" },
      { id: "legs", label: "Miner's pants" },
    ],
    gloves: { label: "Mining gloves", outputMultiplier: 1.05 },
    tool: { label: "Pickaxe" },
    cape: { label: "Mining cape" },
  },
  {
    skill: "fishing",
    skillingSetPieces: [
      { id: "head", label: "Fisherman's hat" },
      { id: "body", label: "Fisherman's jacket" },
      { id: "legs", label: "Fisherman's pants" },
    ],
    gloves: { label: "Fishing gloves", outputMultiplier: 1.05 },
    tool: { label: "Fishing rod" },
    cape: { label: "Fishing cape" },
  },
  {
    skill: "foraging",
    skillingSetPieces: [
      { id: "head", label: "Forager's hat" },
      { id: "body", label: "Forager's jacket" },
      { id: "legs", label: "Forager's shorts" },
    ],
    gloves: { label: "Foraging gloves", outputMultiplier: 1.05 },
    tool: { label: "Secateurs" },
    cape: { label: "Foraging cape" },
  },
  {
    skill: "farming",
    gloves: { label: "Farming gloves", outputMultiplier: 1.05 },
    tool: { label: "Rake" },
    cape: { label: "Farming cape" },
  },
  {
    skill: "carpentry",
    gloves: { label: "Carpentry gloves", outputMultiplier: 1.05 },
    tool: { label: "Saw" },
    cape: { label: "Carpentry cape" },
  },
  {
    skill: "cooking",
    skillingSetPieces: [
      { id: "head", label: "Cooking cap" },
      { id: "body", label: "Cooking jacket" },
      { id: "legs", label: "Cooking pants" },
    ],
    gloves: { label: "Cooking gloves", outputMultiplier: 1.05 },
    tool: { label: "Cooking pan" },
    cape: { label: "Cooking cape" },
  },
  {
    skill: "crafting",
    skillingSetPieces: [
      { id: "head", label: "Wolf fur hat" },
      { id: "body", label: "Wolf fur jacket" },
      { id: "legs", label: "Wolf fur pants" },
    ],
    gloves: { label: "Crafting gloves", outputMultiplier: 1.05 },
    tool: { label: "Crafting needle" },
    cape: { label: "Crafting cape" },
  },
  {
    skill: "smithing",
    gloves: { label: "Smithing gloves", outputMultiplier: 1.05 },
    tool: { label: "Hammer" },
    cape: { label: "Smithing cape" },
  },
  {
    skill: "smelting",
    gloves: { label: "Smithing gloves", outputMultiplier: 1.05 },
    tool: { label: "Hammer" },
    cape: { label: "Smithing cape" },
  },
  {
    skill: "enchanting",
    cape: { label: "Enchanting cape" },
  },
  {
    skill: "brewing",
    gloves: { label: "Brewing gloves", outputMultiplier: 1.05 },
    tool: { label: "Philosopher's stone" },
    cape: { label: "Brewing cape" },
  },
  {
    skill: "item_creation",
    gloves: { label: "Crafting gloves", outputMultiplier: 1.05 },
    cape: { label: "Crafting cape" },
  },
];

export const SKILL_GEAR_BY_SLUG = new Map(
  SKILL_GEAR_DEFINITIONS.map((definition) => [definition.skill, definition]),
);

export function gearSkillsInOrder(): SkillSlug[] {
  return SKILL_SLUGS.filter((slug) => SKILL_GEAR_BY_SLUG.has(slug));
}
