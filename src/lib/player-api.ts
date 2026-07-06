import type { ClanRecruitment, PlayerBundle, PlayerProfile } from "../bonuses/types.ts";

const PLAYER_API_BASE = "https://query.idleclans.com/api";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseUpgradeMap(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  const result: Record<string, number> = {};
  for (const [key, tier] of Object.entries(value)) {
    if (typeof tier === "number" && Number.isFinite(tier)) {
      result[key] = tier;
    }
  }
  return result;
}

function parseNumberMap(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  const result: Record<string, number> = {};
  for (const [key, amount] of Object.entries(value)) {
    if (typeof amount === "number" && Number.isFinite(amount)) {
      result[key] = amount;
    }
  }
  return result;
}

function parseEquipment(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  const result: Record<string, number> = {};
  for (const [slot, itemId] of Object.entries(value)) {
    if (typeof itemId === "number" && Number.isFinite(itemId)) {
      result[slot] = itemId;
    }
  }
  return result;
}

function parseEnchantmentBoosts(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  const result: Record<string, number> = {};
  for (const [key, boost] of Object.entries(value)) {
    if (typeof boost === "number" && Number.isFinite(boost) && boost > 0) {
      result[key] = boost;
    }
  }
  return result;
}

function parsePlayerProfile(data: unknown): PlayerProfile {
  if (!isRecord(data)) {
    throw new Error("Invalid player profile response");
  }

  const username = parseString(data.username);
  if (!username) {
    throw new Error("Invalid player profile response");
  }

  const guildName = parseString(data.guildName);

  return {
    username,
    guildName,
    upgrades: parseUpgradeMap(data.upgrades),
    enchantmentBoosts: parseEnchantmentBoosts(data.enchantmentBoosts),
    equipment: parseEquipment(data.equipment),
  };
}

function parseSerializedUpgrades(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is number => typeof entry === "number");
  }
  if (typeof value === "string" && value.length > 0) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((entry): entry is number => typeof entry === "number");
      }
    } catch {
      return [];
    }
  }
  return [];
}

function parseClanRecruitment(data: unknown): ClanRecruitment {
  if (!isRecord(data)) {
    throw new Error("Invalid clan recruitment response");
  }

  const clanName = parseString(data.clanName);
  if (!clanName) {
    throw new Error("Invalid clan recruitment response");
  }

  return {
    clanName,
    serializedUpgrades: parseSerializedUpgrades(data.serializedUpgrades),
    repeatableUpgradeCounts: parseNumberMap(data.repeatableUpgradeCounts),
  };
}

async function fetchJson(url: string, label: string): Promise<unknown> {
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (response.status === 404) {
    throw new Error(`${label} not found`);
  }

  if (!response.ok) {
    throw new Error(`${label} HTTP ${response.status}`);
  }

  return response.json();
}

export async function fetchPlayerProfile(username: string): Promise<PlayerProfile> {
  const trimmed = username.trim();
  if (!trimmed) {
    throw new Error("Username is required");
  }

  const data = await fetchJson(
    `${PLAYER_API_BASE}/Player/profile/${encodeURIComponent(trimmed)}`,
    `Player "${trimmed}"`,
  );
  return parsePlayerProfile(data);
}

export async function fetchClanRecruitment(
  clanName: string,
): Promise<ClanRecruitment> {
  const trimmed = clanName.trim();
  if (!trimmed) {
    throw new Error("Clan name is required");
  }

  const data = await fetchJson(
    `${PLAYER_API_BASE}/Clan/recruitment/${encodeURIComponent(trimmed)}`,
    `Clan "${trimmed}"`,
  );
  return parseClanRecruitment(data);
}

export async function fetchPlayerBundle(username: string): Promise<PlayerBundle> {
  const profile = await fetchPlayerProfile(username);
  let clan: ClanRecruitment | null = null;

  if (profile.guildName) {
    try {
      clan = await fetchClanRecruitment(profile.guildName);
    } catch {
      clan = null;
    }
  }

  return {
    username: profile.username,
    profile,
    clan,
    fetchedAt: new Date().toISOString(),
  };
}
