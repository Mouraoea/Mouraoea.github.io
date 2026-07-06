import type { SkillSlug } from "../recipes/types.ts";

export interface SkillBonuses {
  /**
   * Derived from skilling and clan speed fractions.
   * effectiveTime = baseTime / speedMultiplier
   */
  speedMultiplier: number;
  /** Additive skilling speed from gear, tools, jewelry, capes, enchants (capped at 80%). */
  skillingSpeedFraction: number;
  /** Clan speed bonuses (e.g. Gatherers), applied separately per wiki. */
  clanSpeedFraction: number;
  /** 0.9 = 10% fewer materials consumed. */
  inputCostMultiplier: number;
  /** 1.1 = 10% more output. */
  outputMultiplier: number;
}

export const DEFAULT_SKILL_BONUSES: SkillBonuses = {
  speedMultiplier: 1,
  skillingSpeedFraction: 0,
  clanSpeedFraction: 0,
  inputCostMultiplier: 1,
  outputMultiplier: 1,
};

export interface PlayerProfile {
  username: string;
  guildName: string | null;
  upgrades: Record<string, number>;
  enchantmentBoosts: Record<string, number>;
  equipment: Record<string, number>;
}

export interface ClanRecruitment {
  clanName: string;
  serializedUpgrades: number[];
  repeatableUpgradeCounts: Record<string, number>;
}

export interface PlayerBundle {
  username: string;
  profile: PlayerProfile;
  clan: ClanRecruitment | null;
  fetchedAt: string;
}

export type BonusEffectKind = "speed" | "input" | "output";

export interface UpgradeTierEffect {
  kind: BonusEffectKind;
  /** Multiply the matching bonus field by this factor at the given tier. */
  multiplierAtTier: (tier: number) => number;
}

export interface PlayerUpgradeDefinition {
  apiKey: string;
  skills: SkillSlug[];
  effects: UpgradeTierEffect[];
}

export interface ClanUpgradeDefinition {
  type: number;
  locKey: string;
  skills: SkillSlug[];
  effects: UpgradeTierEffect[];
}

export interface UpgradeCatalog {
  playerUpgrades: Map<string, PlayerUpgradeDefinition>;
  clanUpgrades: Map<number, ClanUpgradeDefinition>;
}
