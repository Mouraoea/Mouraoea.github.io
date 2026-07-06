import { applyManualGearBonuses } from "./apply-gear-bonuses.ts";
import type { PlayerGearSettings } from "./gear-settings.ts";
import { SKILL_DEFINITIONS } from "../recipes/skills.ts";
import type { SkillSlug } from "../recipes/types.ts";
import {
  addClanSpeedFraction,
  addSkillingSpeedFraction,
  finalizeSpeedMultiplier,
  MAX_SKILLING_SPEED_FRACTION,
  parseSpeedBonusValue,
  speedMultiplierToFraction,
} from "./speed-bonuses.ts";
import type {
  ClanRecruitment,
  PlayerProfile,
  SkillBonuses,
  UpgradeCatalog,
  UpgradeTierEffect,
} from "./types.ts";
import { DEFAULT_SKILL_BONUSES } from "./types.ts";

const SKILL_SLUG_ALIASES: Record<string, SkillSlug> = {
  woodcutting: "woodcutting",
  fishing: "fishing",
  mining: "mining",
  foraging: "foraging",
  farming: "farming",
  crafting: "crafting",
  cooking: "cooking",
  carpentry: "carpentry",
  smithing: "smithing",
  smelting: "smelting",
  brewing: "brewing",
  enchanting: "enchanting",
  itemcreation: "item_creation",
  item_creation: "item_creation",
};

function multiplyBonuses(
  bonuses: SkillBonuses,
  effect: UpgradeTierEffect,
  tier: number,
): void {
  const factor = effect.multiplierAtTier(tier);
  if (!Number.isFinite(factor) || factor <= 0) return;

  switch (effect.kind) {
    case "speed":
      addSkillingSpeedFraction(bonuses, speedMultiplierToFraction(factor));
      break;
    case "input":
      bonuses.inputCostMultiplier *= factor;
      break;
    case "output":
      bonuses.outputMultiplier *= factor;
      break;
  }
}

function appliesToSkill(definitionSkills: SkillSlug[], skill: SkillSlug): boolean {
  if (definitionSkills.includes(skill)) return true;
  if (skill === "smelting" && definitionSkills.includes("smithing")) {
    return true;
  }
  return false;
}

function resolveEnchantmentSpeedBonus(
  enchantmentBoosts: Record<string, number>,
  skill: SkillSlug,
): number {
  const def = SKILL_DEFINITIONS.find((entry) => entry.slug === skill);
  const tasksKey = skill === "smelting" ? "Smithing" : def?.tasksKey;
  const keys = [
    skill,
    tasksKey?.toLowerCase(),
    tasksKey,
  ].filter((key): key is string => typeof key === "string" && key.length > 0);

  let bestFraction = 0;
  for (const [rawKey, value] of Object.entries(enchantmentBoosts)) {
    const normalized = rawKey.toLowerCase().replace(/\s+/g, "");
    const matches = keys.some(
      (key) => key.toLowerCase().replace(/\s+/g, "") === normalized,
    );
    if (!matches) continue;

    bestFraction = Math.max(bestFraction, parseSpeedBonusValue(value));
  }

  return bestFraction;
}

function applyPlayerUpgrades(
  bonuses: SkillBonuses,
  skill: SkillSlug,
  profile: PlayerProfile,
  catalog: UpgradeCatalog,
): void {
  for (const [apiKey, tier] of Object.entries(profile.upgrades)) {
    if (tier <= 0) continue;

    const definition = catalog.playerUpgrades.get(apiKey);
    if (!definition) continue;

    if (!appliesToSkill(definition.skills, skill)) continue;

    for (const effect of definition.effects) {
      multiplyBonuses(bonuses, effect, tier);
    }
  }
}

function applyClanUpgrades(
  bonuses: SkillBonuses,
  skill: SkillSlug,
  clan: ClanRecruitment,
  catalog: UpgradeCatalog,
): void {
  for (const type of clan.serializedUpgrades) {
    const definition = catalog.clanUpgrades.get(type);
    if (!definition) continue;

    const tier = clan.repeatableUpgradeCounts[String(type)] ?? 1;
    if (!appliesToSkill(definition.skills, skill)) continue;

    for (const effect of definition.effects) {
      if (effect.kind === "speed") {
        const factor = effect.multiplierAtTier(tier);
        addClanSpeedFraction(bonuses, speedMultiplierToFraction(factor));
        continue;
      }
      multiplyBonuses(bonuses, effect, tier);
    }
  }
}

function applyEnchantmentBoosts(
  bonuses: SkillBonuses,
  skill: SkillSlug,
  profile: PlayerProfile,
): void {
  const speedFraction = resolveEnchantmentSpeedBonus(
    profile.enchantmentBoosts,
    skill,
  );
  if (speedFraction > 0) {
    addSkillingSpeedFraction(bonuses, speedFraction);
  }
}

function applyEquipmentBonuses(
  bonuses: SkillBonuses,
  skill: SkillSlug,
  gearSettings: PlayerGearSettings | null | undefined,
): void {
  if (!gearSettings?.useManualGear) return;

  const loadout = gearSettings.loadouts[skill];
  if (!loadout) return;

  applyManualGearBonuses(bonuses, skill, loadout);
}

export function resolveSkillBonuses(
  skill: SkillSlug,
  profile: PlayerProfile | null,
  clan: ClanRecruitment | null,
  catalog: UpgradeCatalog | null,
  gearSettings?: PlayerGearSettings | null,
): SkillBonuses {
  const bonuses: SkillBonuses = { ...DEFAULT_SKILL_BONUSES };

  if (profile && catalog) {
    applyPlayerUpgrades(bonuses, skill, profile, catalog);
    if (clan) {
      applyClanUpgrades(bonuses, skill, clan, catalog);
    }
    if (!gearSettings?.useManualGear) {
      applyEnchantmentBoosts(bonuses, skill, profile);
    }
  }

  applyEquipmentBonuses(bonuses, skill, gearSettings);

  bonuses.inputCostMultiplier = Math.max(0.01, bonuses.inputCostMultiplier);
  finalizeSpeedMultiplier(bonuses);

  return bonuses;
}

export function formatSkillBonusesSummary(bonuses: SkillBonuses): string {
  const skillingPct = Math.min(
    MAX_SKILLING_SPEED_FRACTION,
    bonuses.skillingSpeedFraction,
  ) * 100;
  const clanPct = bonuses.clanSpeedFraction * 100;

  let speedLabel = `Speed ×${bonuses.speedMultiplier.toFixed(2)}`;
  if (skillingPct > 0 || clanPct > 0) {
    const parts: string[] = [];
    if (skillingPct > 0) {
      parts.push(`${skillingPct.toFixed(0)}% skilling`);
    }
    if (clanPct > 0) {
      parts.push(`${clanPct.toFixed(0)}% clan`);
    }
    speedLabel += ` (${parts.join(", ")})`;
  }

  return [
    speedLabel,
    `Input ×${bonuses.inputCostMultiplier.toFixed(2)}`,
    `Output ×${bonuses.outputMultiplier.toFixed(2)}`,
  ].join(" · ");
}

export function bonusesAreActive(bonuses: SkillBonuses): boolean {
  return (
    bonuses.speedMultiplier !== 1 ||
    bonuses.inputCostMultiplier !== 1 ||
    bonuses.outputMultiplier !== 1
  );
}

export function normalizeEnchantmentSkillKey(key: string): SkillSlug | null {
  const normalized = key.toLowerCase().replace(/\s+/g, "_");
  return SKILL_SLUG_ALIASES[normalized] ?? null;
}
