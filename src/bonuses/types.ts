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
  /** Gold ingredient cost multiplier (e.g. Plank bargain on carpentry). */
  goldInputCostMultiplier: number;
  /** 1.1 = 10% more output. */
  outputMultiplier: number;
  /** Output multipliers that only apply to specific products (e.g. Arrow crafter: arrows only). */
  productOutputMultipliers: ProductOutputMultiplier[];
}

/** An output boost scoped to a subset of products (matched by product id). */
export interface ProductOutputMultiplier {
  sourceId: string;
  label: string;
  multiplier: number;
  matches: (productId: string) => boolean;
}

export const DEFAULT_SKILL_BONUSES: SkillBonuses = {
  speedMultiplier: 1,
  skillingSpeedFraction: 0,
  clanSpeedFraction: 0,
  inputCostMultiplier: 1,
  goldInputCostMultiplier: 1,
  outputMultiplier: 1,
  productOutputMultipliers: [],
};

export type BonusContributionKind = "speed" | "input" | "output" | "goldInput";

export interface BonusContribution {
  sourceId: string;
  label: string;
  kind: BonusContributionKind;
  factor: number;
  items?: string[];
  /** When set on an output contribution, it only applies to matching products. */
  productMatches?: (productId: string) => boolean;
}

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
  /** When set on input effects, only these ingredient item ids are affected. */
  items?: string[];
  /**
   * When set on an output effect, the boost only applies to products whose id
   * matches (e.g. Arrow crafter → arrows only) instead of the whole recipe.
   */
  productMatches?: (productId: string) => boolean;
}

export interface ResolvedSkillBonuses {
  bonuses: SkillBonuses;
  contributions: BonusContribution[];
}

export interface PlayerUpgradeDefinition {
  apiKey: string;
  skills: SkillSlug[];
  effects: UpgradeTierEffect[];
  /** Highest tier this upgrade can reach (defaults to 1). */
  maxTier?: number;
  /**
   * When true, this upgrade is a single-purchase local-market perk that can be
   * toggled manually in the gear loadout so users can plan buying it.
   */
  manualToggle?: boolean;
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
