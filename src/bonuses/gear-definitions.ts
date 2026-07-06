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

export interface SkillGearToggleDefinition {
  speedMultiplier?: number;
  outputMultiplier?: number;
}

export interface SkillGearDefinition {
  skill: SkillSlug;
  skillingSetPieces?: SkillingSetPieceDefinition[];
  gloves?: SkillGearToggleDefinition;
  tool?: true;
  cape?: true;
}

/** Wiki-sourced skilling gear, gloves, tools, and capes per profit skill. */
export const SKILL_GEAR_DEFINITIONS: SkillGearDefinition[] = [
  {
    skill: "woodcutting",
    skillingSetPieces: [{ id: "head" }, { id: "body" }, { id: "legs" }],
    gloves: { outputMultiplier: 1.05 },
    tool: true,
    cape: true,
  },
  {
    skill: "mining",
    skillingSetPieces: [{ id: "head" }, { id: "body" }, { id: "legs" }],
    gloves: { outputMultiplier: 1.05 },
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
