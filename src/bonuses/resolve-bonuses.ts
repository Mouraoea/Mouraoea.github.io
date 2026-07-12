import { applyManualGearBonuses } from "./apply-gear-bonuses.ts";
import type { EffectiveGearSettings, PlayerGearSettings } from "./gear-settings.ts";
import {
  withActivePresetLoadouts,
  withPresetLoadouts,
} from "./gear-settings.ts";
import { SKILL_DEFINITIONS } from "../recipes/skills.ts";
import type { SkillSlug } from "../recipes/types.ts";
import i18n from "../i18n/index.ts";
import {
  translateClanUpgrade,
  translateEnchantmentBoost,
  translatePlayerUpgrade,
} from "../i18n/upgrade-labels.ts";
import {
  addClanSpeedFraction,
  addSkillingSpeedFraction,
  finalizeSpeedMultiplier,
  MAX_SKILLING_SPEED_FRACTION,
  parseSpeedBonusValue,
  speedMultiplierToFraction,
} from "./speed-bonuses.ts";
import type {
  BonusContribution,
  ClanRecruitment,
  PlayerProfile,
  ResolvedSkillBonuses,
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

interface ContributionTemplate {
  sourceId: string;
  label: string;
}

function multiplyBonuses(
  bonuses: SkillBonuses,
  effect: UpgradeTierEffect,
  tier: number,
  template: ContributionTemplate | null,
  contributions: BonusContribution[],
): void {
  const factor = effect.multiplierAtTier(tier);
  if (!Number.isFinite(factor) || factor < 0) return;

  if (effect.kind === "input" && effect.items?.length) {
    for (const item of effect.items) {
      if (item === "gold") {
        bonuses.goldInputCostMultiplier *= factor;
        if (template && factor !== 1) {
          contributions.push({
            ...template,
            kind: "goldInput",
            factor,
            items: effect.items,
          });
        }
      }
    }
    return;
  }

  if (factor <= 0) return;

  switch (effect.kind) {
    case "speed":
      addSkillingSpeedFraction(bonuses, speedMultiplierToFraction(factor));
      if (template && factor !== 1) {
        contributions.push({ ...template, kind: "speed", factor });
      }
      break;
    case "input":
      bonuses.inputCostMultiplier *= factor;
      if (template && factor !== 1) {
        contributions.push({ ...template, kind: "input", factor });
      }
      break;
    case "output":
      bonuses.outputMultiplier *= factor;
      if (template && factor !== 1) {
        contributions.push({ ...template, kind: "output", factor });
      }
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
  contributions: BonusContribution[],
): void {
  for (const [apiKey, tier] of Object.entries(profile.upgrades)) {
    if (tier <= 0) continue;

    const definition = catalog.playerUpgrades.get(apiKey);
    if (!definition) continue;

    if (!appliesToSkill(definition.skills, skill)) continue;

    const template: ContributionTemplate = {
      sourceId: apiKey,
      label: translatePlayerUpgrade(apiKey),
    };

    for (const effect of definition.effects) {
      multiplyBonuses(bonuses, effect, tier, template, contributions);
    }
  }
}

function applyClanUpgrades(
  bonuses: SkillBonuses,
  skill: SkillSlug,
  clan: ClanRecruitment,
  catalog: UpgradeCatalog,
  contributions: BonusContribution[],
): void {
  for (const type of clan.serializedUpgrades) {
    const definition = catalog.clanUpgrades.get(type);
    if (!definition) continue;

    const tier = clan.repeatableUpgradeCounts[String(type)] ?? 1;
    if (!appliesToSkill(definition.skills, skill)) continue;

    const template: ContributionTemplate = {
      sourceId: `clan:${type}`,
      label: translateClanUpgrade(definition.locKey),
    };

    for (const effect of definition.effects) {
      if (effect.kind === "speed") {
        const factor = effect.multiplierAtTier(tier);
        addClanSpeedFraction(bonuses, speedMultiplierToFraction(factor));
        if (factor !== 1) {
          contributions.push({ ...template, kind: "speed", factor });
        }
        continue;
      }
      multiplyBonuses(bonuses, effect, tier, template, contributions);
    }
  }
}

function applyEnchantmentBoosts(
  bonuses: SkillBonuses,
  skill: SkillSlug,
  profile: PlayerProfile,
  contributions: BonusContribution[],
): void {
  const speedFraction = resolveEnchantmentSpeedBonus(
    profile.enchantmentBoosts,
    skill,
  );
  if (speedFraction > 0) {
    addSkillingSpeedFraction(bonuses, speedFraction);
    contributions.push({
      sourceId: "enchantment",
      label: translateEnchantmentBoost(),
      kind: "speed",
      factor: 1 + speedFraction,
    });
  }
}

function applyEquipmentBonuses(
  bonuses: SkillBonuses,
  skill: SkillSlug,
  gearSettings: EffectiveGearSettings | null | undefined,
  contributions: BonusContribution[],
): void {
  if (!gearSettings?.useManualGear) return;

  const loadout = gearSettings.loadouts[skill];
  if (!loadout) return;

  applyManualGearBonuses(bonuses, skill, loadout, contributions);
}

export function resolveSkillBonusesWithContributions(
  skill: SkillSlug,
  profile: PlayerProfile | null,
  clan: ClanRecruitment | null,
  catalog: UpgradeCatalog | null,
  gearSettings?: PlayerGearSettings | null,
  presetIndex?: number,
): ResolvedSkillBonuses {
  const bonuses: SkillBonuses = { ...DEFAULT_SKILL_BONUSES };
  const contributions: BonusContribution[] = [];

  if (profile && catalog) {
    applyPlayerUpgrades(bonuses, skill, profile, catalog, contributions);
    if (clan) {
      applyClanUpgrades(bonuses, skill, clan, catalog, contributions);
    }
    if (!gearSettings?.useManualGear) {
      applyEnchantmentBoosts(bonuses, skill, profile, contributions);
    }
  }

  const effectiveGear = gearSettings
    ? presetIndex !== undefined
      ? withPresetLoadouts(gearSettings, presetIndex)
      : withActivePresetLoadouts(gearSettings)
    : null;
  applyEquipmentBonuses(bonuses, skill, effectiveGear, contributions);

  bonuses.inputCostMultiplier = Math.max(0.01, bonuses.inputCostMultiplier);
  bonuses.goldInputCostMultiplier = Math.max(0, bonuses.goldInputCostMultiplier);
  finalizeSpeedMultiplier(bonuses);

  return { bonuses, contributions };
}

export function resolveSkillBonuses(
  skill: SkillSlug,
  profile: PlayerProfile | null,
  clan: ClanRecruitment | null,
  catalog: UpgradeCatalog | null,
  gearSettings?: PlayerGearSettings | null,
  presetIndex?: number,
): SkillBonuses {
  return resolveSkillBonusesWithContributions(
    skill,
    profile,
    clan,
    catalog,
    gearSettings,
    presetIndex,
  ).bonuses;
}

export function formatSkillBonusesSummary(bonuses: SkillBonuses): string {
  const skillingPct = Math.min(
    MAX_SKILLING_SPEED_FRACTION,
    bonuses.skillingSpeedFraction,
  ) * 100;
  const clanPct = bonuses.clanSpeedFraction * 100;

  let speedLabel = i18n.t("gear:bonuses.speed", {
    value: bonuses.speedMultiplier.toFixed(2),
  });
  if (skillingPct > 0 || clanPct > 0) {
    const parts: string[] = [];
    if (skillingPct > 0) {
      parts.push(
        i18n.t("gear:bonuses.speedSkilling", {
          pct: skillingPct.toFixed(0),
        }),
      );
    }
    if (clanPct > 0) {
      parts.push(
        i18n.t("gear:bonuses.speedClan", {
          pct: clanPct.toFixed(0),
        }),
      );
    }
    speedLabel += ` (${parts.join(", ")})`;
  }

  const parts = [
    speedLabel,
    i18n.t("gear:bonuses.input", {
      value: bonuses.inputCostMultiplier.toFixed(2),
    }),
    i18n.t("gear:bonuses.output", {
      value: bonuses.outputMultiplier.toFixed(2),
    }),
  ];

  if (bonuses.goldInputCostMultiplier !== 1) {
    parts.push(
      i18n.t("gear:bonuses.input", {
        value: bonuses.goldInputCostMultiplier.toFixed(2),
      }) + " (gold)",
    );
  }

  return parts.join(" · ");
}

export function bonusesAreActive(bonuses: SkillBonuses): boolean {
  return (
    bonuses.speedMultiplier !== 1 ||
    bonuses.inputCostMultiplier !== 1 ||
    bonuses.goldInputCostMultiplier !== 1 ||
    bonuses.outputMultiplier !== 1
  );
}

export function normalizeEnchantmentSkillKey(key: string): SkillSlug | null {
  const normalized = key.toLowerCase().replace(/\s+/g, "_");
  return SKILL_SLUG_ALIASES[normalized] ?? null;
}
