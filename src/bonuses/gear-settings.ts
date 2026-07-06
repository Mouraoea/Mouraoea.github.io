import type { SkillSlug } from "../recipes/types.ts";
import { SKILL_SLUGS } from "../recipes/types.ts";
import { gearSkillsInOrder } from "./gear-definitions.ts";

export const PLAYER_GEAR_SETTINGS_VERSION = 1 as const;

export interface SkillGearSetPieces {
  head: boolean;
  body: boolean;
  legs: boolean;
}

export interface SkillGearLoadout {
  setPieces: SkillGearSetPieces;
  gloves: boolean;
  toolTier: number;
  capeTier: number;
  /** Free-text jewelry enchant speed bonus, e.g. "15" or "15%". Empty = 0%. */
  jewelryEnchantmentSpeed: string;
}

export interface PlayerGearSettings {
  version: typeof PLAYER_GEAR_SETTINGS_VERSION;
  /** When true, manual loadouts apply in the profit calculator. */
  useManualGear: boolean;
  loadouts: Record<SkillSlug, SkillGearLoadout>;
}

export function emptySkillGearSetPieces(): SkillGearSetPieces {
  return { head: false, body: false, legs: false };
}

export function emptySkillGearLoadout(): SkillGearLoadout {
  return {
    setPieces: emptySkillGearSetPieces(),
    gloves: false,
    toolTier: 0,
    capeTier: 0,
    jewelryEnchantmentSpeed: "",
  };
}

/** Parse jewelry enchant speed from free text. Returns 0–20 (percent). */
export function parseJewelryEnchantmentSpeedPercent(raw: string): number {
  const trimmed = raw.trim().replace(/%$/, "").trim();
  if (!trimmed) return 0;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(20, value);
}

export function createDefaultGearSettings(): PlayerGearSettings {
  const loadouts = {} as Record<SkillSlug, SkillGearLoadout>;
  for (const skill of gearSkillsInOrder()) {
    loadouts[skill] = emptySkillGearLoadout();
  }
  return {
    version: PLAYER_GEAR_SETTINGS_VERSION,
    useManualGear: false,
    loadouts,
  };
}

function parseSetPieces(
  entry: Record<string, unknown>,
): SkillGearSetPieces {
  const nested = entry.setPieces;
  if (typeof nested === "object" && nested !== null) {
    const pieces = nested as Record<string, unknown>;
    return {
      head: pieces.head === true,
      body: pieces.body === true,
      legs: pieces.legs === true,
    };
  }

  if (entry.skillingSet === true) {
    return { head: true, body: true, legs: true };
  }

  return emptySkillGearSetPieces();
}

function parseSkillGearLoadout(value: unknown): SkillGearLoadout | null {
  if (typeof value !== "object" || value === null) return null;
  const entry = value as Record<string, unknown>;

  if (
    typeof entry.gloves !== "boolean" ||
    typeof entry.toolTier !== "number" ||
    typeof entry.capeTier !== "number"
  ) {
    return null;
  }

  return {
    setPieces: parseSetPieces(entry),
    gloves: entry.gloves,
    toolTier: Math.max(0, Math.min(8, Math.round(entry.toolTier))),
    capeTier: Math.max(0, Math.min(4, Math.round(entry.capeTier))),
    jewelryEnchantmentSpeed:
      typeof entry.jewelryEnchantmentSpeed === "string"
        ? entry.jewelryEnchantmentSpeed
        : "",
  };
}

export function normalizeGearSettings(value: unknown): PlayerGearSettings {
  const defaults = createDefaultGearSettings();
  if (typeof value !== "object" || value === null) return defaults;

  const record = value as Record<string, unknown>;
  const useManualGear =
    typeof record.useManualGear === "boolean" ? record.useManualGear : false;

  const loadouts = { ...defaults.loadouts };
  if (typeof record.loadouts === "object" && record.loadouts !== null) {
    for (const skill of SKILL_SLUGS) {
      const parsed = parseSkillGearLoadout(
        (record.loadouts as Record<string, unknown>)[skill],
      );
      if (parsed) {
        loadouts[skill] = parsed;
      }
    }
  }

  return {
    version: PLAYER_GEAR_SETTINGS_VERSION,
    useManualGear,
    loadouts,
  };
}
