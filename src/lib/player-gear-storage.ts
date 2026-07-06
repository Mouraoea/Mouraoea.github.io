import type { PlayerGearSettings } from "../bonuses/gear-settings.ts";
import {
  createDefaultGearSettings,
  normalizeGearSettings,
} from "../bonuses/gear-settings.ts";

const GEAR_STORE_KEY = "idleclans-player-gear-by-character";
const LEGACY_GEAR_KEY = "idleclans-player-gear-settings";

interface PlayerGearStore {
  version: 1;
  byUsername: Record<string, PlayerGearSettings>;
}

function emptyGearStore(): PlayerGearStore {
  return { version: 1, byUsername: {} };
}

function normalizeUsername(username: string): string {
  return username.trim();
}

function normalizeGearStore(value: unknown): PlayerGearStore {
  if (typeof value !== "object" || value === null) return emptyGearStore();
  const record = value as Record<string, unknown>;
  if (record.version !== 1 || typeof record.byUsername !== "object") {
    return emptyGearStore();
  }

  const byUsername: Record<string, PlayerGearSettings> = {};
  for (const [username, settings] of Object.entries(
    record.byUsername as Record<string, unknown>,
  )) {
    const normalized = normalizeUsername(username);
    if (!normalized) continue;
    byUsername[normalized] = normalizeGearSettings(settings);
  }

  return { version: 1, byUsername };
}

function migrateLegacyGearStore(activeUsername: string | null): PlayerGearStore {
  if (typeof localStorage === "undefined") return emptyGearStore();

  try {
    const raw = localStorage.getItem(LEGACY_GEAR_KEY);
    if (!raw) return emptyGearStore();

    const settings = normalizeGearSettings(JSON.parse(raw));
    localStorage.removeItem(LEGACY_GEAR_KEY);

    if (!activeUsername) return emptyGearStore();
    return {
      version: 1,
      byUsername: { [activeUsername]: settings },
    };
  } catch {
    return emptyGearStore();
  }
}

function loadGearStore(activeUsername: string | null): PlayerGearStore {
  if (typeof localStorage === "undefined") return emptyGearStore();

  try {
    const raw = localStorage.getItem(GEAR_STORE_KEY);
    if (raw) {
      return normalizeGearStore(JSON.parse(raw));
    }

    const migrated = migrateLegacyGearStore(activeUsername);
    if (Object.keys(migrated.byUsername).length > 0) {
      saveGearStore(migrated);
    }
    return migrated;
  } catch {
    return emptyGearStore();
  }
}

function saveGearStore(store: PlayerGearStore): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(GEAR_STORE_KEY, JSON.stringify(normalizeGearStore(store)));
}

export function loadPlayerGearSettings(
  username: string | null | undefined,
): PlayerGearSettings {
  const normalized = username ? normalizeUsername(username) : "";
  const store = loadGearStore(normalized || null);

  if (normalized && store.byUsername[normalized]) {
    return store.byUsername[normalized];
  }

  return createDefaultGearSettings();
}

export function savePlayerGearSettings(
  username: string,
  settings: PlayerGearSettings,
): void {
  const normalized = normalizeUsername(username);
  if (!normalized) return;

  const store = loadGearStore(normalized);
  store.byUsername[normalized] = normalizeGearSettings(settings);
  saveGearStore(store);
}

export function removePlayerGearSettings(username: string): void {
  const normalized = normalizeUsername(username);
  if (!normalized) return;

  const store = loadGearStore(normalized);
  delete store.byUsername[normalized];
  saveGearStore(store);
}

export function clearPlayerGearSettings(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(GEAR_STORE_KEY);
  localStorage.removeItem(LEGACY_GEAR_KEY);
}
