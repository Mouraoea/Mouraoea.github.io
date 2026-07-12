import i18n from "../i18n/index.ts";
import { translateSkillSlug } from "../i18n/game-labels.ts";
import type { SkillSlug } from "../recipes/types.ts";

export function translatePlayerUpgrade(apiKey: string): string {
  const key = `upgrades:playerUpgrades.${apiKey}`;
  if (i18n.exists(key)) {
    return i18n.t(key);
  }
  return apiKey;
}

export function translateClanUpgrade(locKey: string): string {
  if (locKey === "clan_upgrade_gatherers_desc") {
    return i18n.t("upgrades:clanUpgrades.gatherers");
  }
  return locKey;
}

export function translateGearGloves(skill: SkillSlug): string {
  return i18n.t("upgrades:gear.gloves", {
    skill: translateSkillSlug(skill),
  });
}

export function translateGearTool(tier: number): string {
  return i18n.t("upgrades:gear.tool", { tier });
}

export function translateGearCape(tier: number): string {
  return i18n.t("upgrades:gear.cape", { tier });
}

export function translateGearSetPiece(pieceLabel: string): string {
  return i18n.t("upgrades:gear.setPiece", { piece: pieceLabel });
}

export function translateEnchantmentBoost(): string {
  return i18n.t("upgrades:enchantment");
}

export function translateJewelryEnchant(): string {
  return i18n.t("upgrades:gear.jewelryEnchant");
}
