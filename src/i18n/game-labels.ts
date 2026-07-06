import i18n from "./index.ts";
import type { SkillSlug } from "../recipes/types.ts";
import { formatSkillLabel } from "../recipes/skills.ts";

export function toDisplayName(nameId: string): string {
  return nameId
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function translateNameId(nameId: string): string {
  return i18n.t(`game-names:${nameId}`, {
    defaultValue: toDisplayName(nameId),
  });
}

export function translateSkillSlug(slug: SkillSlug): string {
  return i18n.t(`gear:skills.${slug}`, {
    defaultValue: formatSkillLabel(slug),
  });
}

export function translateSkillGroupLabel(groupKey: "crafting" | "gathering"): string {
  return i18n.t(`gear:skillGroups.${groupKey}`);
}

export function translateToolTier(tier: number): string {
  if (tier <= 0) return i18n.t("gear:none");
  return i18n.t(`gear:toolTiers.${tier}`, {
    defaultValue: String(tier),
  });
}

export function translateGearPieceLabel(
  skill: SkillSlug,
  piece: "head" | "body" | "legs",
): string {
  return i18n.t(`gear:gear.${skill}.setPieces.${piece}`, {
    defaultValue: piece,
  });
}

export function translateGearToggleLabel(
  skill: SkillSlug,
  kind: "gloves" | "tool" | "cape",
): string {
  return i18n.t(`gear:gear.${skill}.${kind}`, {
    defaultValue: kind,
  });
}

export function formatToolTierOption(tier: number, toolLabel: string): string {
  if (tier <= 0) return i18n.t("gear:none");
  const tierName = translateToolTier(tier);
  return i18n.t("gear:toolTierOption", { tier: tierName, tool: toolLabel });
}

export function translateApiError(message: string): string {
  const playerNotFound = /^Player "(.+)" not found$/.exec(message);
  if (playerNotFound) {
    return i18n.t("common:errors.playerNotFound", { name: playerNotFound[1] });
  }

  const playerHttp = /^Player "(.+)" HTTP (\d+)$/.exec(message);
  if (playerHttp) {
    return i18n.t("common:errors.playerHttp", {
      name: playerHttp[1],
      status: playerHttp[2],
    });
  }

  const clanNotFound = /^Clan "(.+)" not found$/.exec(message);
  if (clanNotFound) {
    return i18n.t("common:errors.clanNotFound", { name: clanNotFound[1] });
  }

  const clanHttp = /^Clan "(.+)" HTTP (\d+)$/.exec(message);
  if (clanHttp) {
    return i18n.t("common:errors.clanHttp", {
      name: clanHttp[1],
      status: clanHttp[2],
    });
  }

  const errorKeys: Record<string, string> = {
    "Enter a username": "common:errors.usernameRequired",
    "Username is required": "common:errors.usernameRequiredApi",
    "Clan name is required": "common:errors.clanNameRequired",
    "Invalid player profile response": "common:errors.invalidPlayerProfile",
    "Invalid clan recruitment response": "common:errors.invalidClanRecruitment",
  };

  const key = errorKeys[message];
  if (key) return i18n.t(key);

  return message;
}
