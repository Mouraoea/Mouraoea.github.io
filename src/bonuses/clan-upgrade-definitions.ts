import type { SkillSlug } from "../recipes/types.ts";
import type { ClanUpgradeDefinition } from "./types.ts";

const GATHERING_SKILLS: SkillSlug[] = [
  "mining",
  "woodcutting",
  "fishing",
  "foraging",
];

/** Wiki-sourced clan upgrade effects keyed by game-data Type numbers. */
export const CLAN_UPGRADE_DEFINITIONS: ClanUpgradeDefinition[] = [
  {
    type: 23,
    locKey: "clan_upgrade_gatherers_desc",
    skills: GATHERING_SKILLS,
    effects: [{ kind: "speed", multiplierAtTier: () => 1.05 }],
  },
];

export const CLAN_UPGRADE_BY_TYPE = new Map(
  CLAN_UPGRADE_DEFINITIONS.map((definition) => [definition.type, definition]),
);
