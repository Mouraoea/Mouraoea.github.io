import { loadGameData } from "../recipes/parser.ts";
import {
  CLAN_UPGRADE_BY_TYPE,
  CLAN_UPGRADE_DEFINITIONS,
} from "./clan-upgrade-definitions.ts";
import { PLAYER_UPGRADE_DEFINITIONS } from "./player-upgrade-definitions.ts";
import type {
  ClanUpgradeDefinition,
  PlayerUpgradeDefinition,
  UpgradeCatalog,
} from "./types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseClanUpgradeItem(item: unknown): ClanUpgradeDefinition | null {
  if (!isRecord(item)) return null;
  const type = item.Type;
  if (typeof type !== "number") return null;

  const known = CLAN_UPGRADE_BY_TYPE.get(type);
  if (!known) return null;

  const locKeys = item.TierDescriptionLocKeys;
  const locKey =
    Array.isArray(locKeys) && typeof locKeys[0] === "string"
      ? locKeys[0]
      : known.locKey;

  return {
    ...known,
    locKey,
  };
}

let catalogPromise: Promise<UpgradeCatalog> | null = null;

export async function loadUpgradeCatalog(): Promise<UpgradeCatalog> {
  if (!catalogPromise) {
    catalogPromise = buildUpgradeCatalog();
  }
  return catalogPromise;
}

async function buildUpgradeCatalog(): Promise<UpgradeCatalog> {
  const archive = await loadGameData();
  const clanUpgrades = new Map<number, ClanUpgradeDefinition>();

  for (const definition of CLAN_UPGRADE_DEFINITIONS) {
    clanUpgrades.set(definition.type, definition);
  }

  const clanSection = archive.data.ClanUpgrades;
  if (isRecord(clanSection) && Array.isArray(clanSection.Items)) {
    for (const item of clanSection.Items) {
      const parsed = parseClanUpgradeItem(item);
      if (parsed) {
        clanUpgrades.set(parsed.type, parsed);
      }
    }
  }

  const playerUpgrades = new Map<string, PlayerUpgradeDefinition>();
  for (const definition of PLAYER_UPGRADE_DEFINITIONS) {
    playerUpgrades.set(definition.apiKey, definition);
  }

  return { playerUpgrades, clanUpgrades };
}

export function resetUpgradeCatalogCache(): void {
  catalogPromise = null;
}
