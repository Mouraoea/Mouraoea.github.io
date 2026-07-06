import type { SkillSlug } from "../recipes/types.ts";
import { SKILL_SLUGS } from "../recipes/types.ts";
import {
  CAPE_MAX_TIER,
  gearSkillsInOrder,
  SKILL_GEAR_BY_SLUG,
  TOOL_MAX_TIER,
} from "./gear-definitions.ts";

export const MAX_GEAR_PRESETS = 3 as const;
export const PLAYER_GEAR_SETTINGS_VERSION = 2 as const;

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

export interface GearPreset {
  loadouts: Record<SkillSlug, SkillGearLoadout>;
}

export interface PlayerGearSettings {
  version: typeof PLAYER_GEAR_SETTINGS_VERSION;
  /** When true, manual loadouts apply in the profit calculator. */
  useManualGear: boolean;
  activePresetIndex: number;
  presets: [GearPreset, GearPreset, GearPreset];
}

/** v1-compatible view for bonus resolution. */
export interface EffectiveGearSettings {
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

function buildEmptyLoadouts(): Record<SkillSlug, SkillGearLoadout> {
  const loadouts = {} as Record<SkillSlug, SkillGearLoadout>;
  for (const skill of gearSkillsInOrder()) {
    loadouts[skill] = emptySkillGearLoadout();
  }
  return loadouts;
}

export function createEmptyPreset(): GearPreset {
  return { loadouts: buildEmptyLoadouts() };
}

export function createMinPreset(): GearPreset {
  return createEmptyPreset();
}

export function createMaxPreset(): GearPreset {
  const loadouts = buildEmptyLoadouts();
  for (const skill of gearSkillsInOrder()) {
    const definition = SKILL_GEAR_BY_SLUG.get(skill);
    if (!definition) continue;

    const loadout = loadouts[skill]!;
    if (definition.skillingSetPieces) {
      loadout.setPieces = { head: true, body: true, legs: true };
    }
    if (definition.gloves) {
      loadout.gloves = true;
    }
    if (definition.tool) {
      loadout.toolTier = TOOL_MAX_TIER;
    }
    if (definition.cape) {
      loadout.capeTier = CAPE_MAX_TIER;
    }
    loadout.jewelryEnchantmentSpeed = "20";
  }
  return { loadouts };
}

export function createDefaultGearSettings(): PlayerGearSettings {
  return {
    version: PLAYER_GEAR_SETTINGS_VERSION,
    useManualGear: false,
    activePresetIndex: 0,
    presets: [createEmptyPreset(), createEmptyPreset(), createEmptyPreset()],
  };
}

export function clampPresetIndex(index: number): number {
  return Math.max(0, Math.min(MAX_GEAR_PRESETS - 1, Math.round(index)));
}

export function getActivePreset(settings: PlayerGearSettings): GearPreset {
  return settings.presets[clampPresetIndex(settings.activePresetIndex)]!;
}

export function withActivePresetLoadouts(
  settings: PlayerGearSettings,
): EffectiveGearSettings {
  return {
    useManualGear: settings.useManualGear,
    loadouts: getActivePreset(settings).loadouts,
  };
}

export function withPresetLoadouts(
  settings: PlayerGearSettings,
  presetIndex: number,
): EffectiveGearSettings {
  return {
    useManualGear: settings.useManualGear,
    loadouts: settings.presets[clampPresetIndex(presetIndex)]!.loadouts,
  };
}

function parseSetPieces(entry: Record<string, unknown>): SkillGearSetPieces {
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

function parseLoadoutsRecord(
  value: unknown,
  fallback: Record<SkillSlug, SkillGearLoadout>,
): Record<SkillSlug, SkillGearLoadout> {
  const loadouts = { ...fallback };
  if (typeof value !== "object" || value === null) return loadouts;

  for (const skill of SKILL_SLUGS) {
    const parsed = parseSkillGearLoadout(
      (value as Record<string, unknown>)[skill],
    );
    if (parsed) {
      loadouts[skill] = parsed;
    }
  }
  return loadouts;
}

function parsePreset(value: unknown, fallback: GearPreset): GearPreset {
  if (typeof value !== "object" || value === null) return fallback;
  const record = value as Record<string, unknown>;
  return {
    loadouts: parseLoadoutsRecord(record.loadouts, fallback.loadouts),
  };
}

function migrateV1Record(record: Record<string, unknown>): PlayerGearSettings {
  const defaults = createDefaultGearSettings();
  const useManualGear =
    typeof record.useManualGear === "boolean" ? record.useManualGear : false;

  const migratedLoadouts = parseLoadoutsRecord(record.loadouts, defaults.presets[0]!.loadouts);

  return {
    version: PLAYER_GEAR_SETTINGS_VERSION,
    useManualGear,
    activePresetIndex: 0,
    presets: [
      { loadouts: migratedLoadouts },
      createEmptyPreset(),
      createEmptyPreset(),
    ],
  };
}

export function normalizeGearSettings(value: unknown): PlayerGearSettings {
  const defaults = createDefaultGearSettings();
  if (typeof value !== "object" || value === null) return defaults;

  const record = value as Record<string, unknown>;

  if (record.version !== PLAYER_GEAR_SETTINGS_VERSION || !Array.isArray(record.presets)) {
    if (typeof record.loadouts === "object" && record.loadouts !== null) {
      return migrateV1Record(record);
    }
    return defaults;
  }

  const useManualGear =
    typeof record.useManualGear === "boolean" ? record.useManualGear : false;
  const activePresetIndex = clampPresetIndex(
    typeof record.activePresetIndex === "number"
      ? record.activePresetIndex
      : 0,
  );

  const presetsArray = record.presets as unknown[];
  const presets: [GearPreset, GearPreset, GearPreset] = [
    parsePreset(presetsArray[0], defaults.presets[0]!),
    parsePreset(presetsArray[1], defaults.presets[1]!),
    parsePreset(presetsArray[2], defaults.presets[2]!),
  ];

  return {
    version: PLAYER_GEAR_SETTINGS_VERSION,
    useManualGear,
    activePresetIndex,
    presets,
  };
}
