import {
  CRAFT_SKILL_SLUGS,
  GATHERING_SKILL_SLUGS,
  type SkillSlug,
} from "./types.ts";

export type SkillTaskMode = "craft" | "gathering" | "mixed";

export interface SkillDefinition {
  slug: SkillSlug;
  /** Key under `Tasks` in official game data, if present. */
  tasksKey: string | null;
  /** How tasks are mapped into recipe entries. */
  mode: SkillTaskMode;
  /** When set, recipes are split from another skill's tasks. */
  splitFrom?: {
    tasksKey: string;
    predicate: (taskName: string) => boolean;
  };
}

export const SKILL_DEFINITIONS: SkillDefinition[] = [
  { slug: "carpentry", tasksKey: "Carpentry", mode: "craft" },
  {
    slug: "smelting",
    tasksKey: null,
    mode: "craft",
    splitFrom: {
      tasksKey: "Smithing",
      predicate: (name) => name.endsWith("_bar"),
    },
  },
  { slug: "smithing", tasksKey: "Smithing", mode: "craft" },
  { slug: "cooking", tasksKey: "Cooking", mode: "craft" },
  { slug: "crafting", tasksKey: "Crafting", mode: "craft" },
  { slug: "enchanting", tasksKey: "Enchanting", mode: "craft" },
  { slug: "brewing", tasksKey: "Brewing", mode: "craft" },
  { slug: "item_creation", tasksKey: "ItemCreation", mode: "craft" },
  { slug: "mining", tasksKey: "Mining", mode: "gathering" },
  { slug: "woodcutting", tasksKey: "Woodcutting", mode: "gathering" },
  { slug: "fishing", tasksKey: "Fishing", mode: "mixed" },
  { slug: "foraging", tasksKey: "Foraging", mode: "gathering" },
  { slug: "farming", tasksKey: "Farming", mode: "craft" },
];

export const SKILL_GROUPS = [
  { key: "crafting" as const, slugs: CRAFT_SKILL_SLUGS },
  { key: "gathering" as const, slugs: GATHERING_SKILL_SLUGS },
] as const;

export function tasksKeyToSlug(tasksKey: string): SkillSlug | null {
  const def = SKILL_DEFINITIONS.find((d) => d.tasksKey === tasksKey);
  return def?.slug ?? null;
}

export function formatSkillLabel(slug: SkillSlug): string {
  return slug
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
