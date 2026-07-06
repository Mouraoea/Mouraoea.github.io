import type { PlayerBundle } from "../bonuses/types.ts";

export const MAX_PLAYER_CHARACTERS = 3;

const ROSTER_STORAGE_KEY = "idleclans-player-roster";
const LEGACY_BUNDLE_STORAGE_KEY = "idleclans-player-bundle";

export interface PlayerRoster {
  version: 1;
  activeUsername: string | null;
  characters: PlayerBundle[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPlayerBundle(value: unknown): value is PlayerBundle {
  if (!isRecord(value)) return false;
  if (typeof value.username !== "string" || value.username.length === 0) {
    return false;
  }
  if (typeof value.fetchedAt !== "string") return false;
  if (!isRecord(value.profile)) return false;
  if (typeof value.profile.username !== "string") return false;
  if (!isRecord(value.profile.upgrades)) return false;
  if (value.clan !== null && !isRecord(value.clan)) return false;
  return true;
}

function emptyRoster(): PlayerRoster {
  return { version: 1, activeUsername: null, characters: [] };
}

function normalizeUsername(username: string): string {
  return username.trim();
}

function normalizeRoster(value: unknown): PlayerRoster {
  if (!isRecord(value)) return emptyRoster();
  if (value.version !== 1 || !Array.isArray(value.characters)) {
    return emptyRoster();
  }

  const characters = value.characters
    .filter(isPlayerBundle)
    .slice(0, MAX_PLAYER_CHARACTERS);

  const activeUsername =
    typeof value.activeUsername === "string" &&
    characters.some((character) => character.username === value.activeUsername)
      ? value.activeUsername
      : (characters[0]?.username ?? null);

  return { version: 1, activeUsername, characters };
}

function migrateLegacyBundle(): PlayerRoster | null {
  if (typeof localStorage === "undefined") return null;

  try {
    const raw = localStorage.getItem(LEGACY_BUNDLE_STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isPlayerBundle(parsed)) return null;

    localStorage.removeItem(LEGACY_BUNDLE_STORAGE_KEY);
    return {
      version: 1,
      activeUsername: parsed.username,
      characters: [parsed],
    };
  } catch {
    return null;
  }
}

export function loadPlayerRoster(): PlayerRoster {
  if (typeof localStorage === "undefined") return emptyRoster();

  try {
    const raw = localStorage.getItem(ROSTER_STORAGE_KEY);
    if (raw) {
      return normalizeRoster(JSON.parse(raw));
    }

    const migrated = migrateLegacyBundle();
    if (migrated) {
      savePlayerRoster(migrated);
      return migrated;
    }

    return emptyRoster();
  } catch {
    return emptyRoster();
  }
}

export function savePlayerRoster(roster: PlayerRoster): void {
  if (typeof localStorage === "undefined") return;

  const normalized = normalizeRoster(roster);
  localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(normalized));
}

export function getActivePlayerBundle(roster: PlayerRoster): PlayerBundle | null {
  if (!roster.activeUsername) return null;
  return (
    roster.characters.find(
      (character) => character.username === roster.activeUsername,
    ) ?? null
  );
}

export function upsertPlayerCharacter(bundle: PlayerBundle): PlayerRoster {
  const roster = loadPlayerRoster();
  const username = normalizeUsername(bundle.username);
  const normalizedBundle = { ...bundle, username };

  const existingIndex = roster.characters.findIndex(
    (character) => character.username === username,
  );

  let characters: PlayerBundle[];
  if (existingIndex >= 0) {
    characters = [...roster.characters];
    characters[existingIndex] = normalizedBundle;
  } else if (roster.characters.length >= MAX_PLAYER_CHARACTERS) {
    throw new Error(
      `Maximum ${MAX_PLAYER_CHARACTERS} characters saved. Remove one before adding another.`,
    );
  } else {
    characters = [...roster.characters, normalizedBundle];
  }

  const next: PlayerRoster = {
    version: 1,
    activeUsername: username,
    characters,
  };
  savePlayerRoster(next);
  return next;
}

export function setActivePlayerCharacter(username: string): PlayerRoster {
  const roster = loadPlayerRoster();
  const normalized = normalizeUsername(username);
  if (!roster.characters.some((character) => character.username === normalized)) {
    return roster;
  }

  const next: PlayerRoster = {
    ...roster,
    activeUsername: normalized,
  };
  savePlayerRoster(next);
  return next;
}

export function removePlayerCharacter(username: string): PlayerRoster {
  const roster = loadPlayerRoster();
  const normalized = normalizeUsername(username);
  const characters = roster.characters.filter(
    (character) => character.username !== normalized,
  );

  const next: PlayerRoster = {
    version: 1,
    activeUsername:
      roster.activeUsername === normalized
        ? (characters[0]?.username ?? null)
        : roster.activeUsername,
    characters,
  };
  savePlayerRoster(next);
  return next;
}

/** @deprecated Use loadPlayerRoster + getActivePlayerBundle */
export function loadPlayerBundle(): PlayerBundle | null {
  return getActivePlayerBundle(loadPlayerRoster());
}

/** @deprecated Use upsertPlayerCharacter */
export function savePlayerBundle(bundle: PlayerBundle): void {
  upsertPlayerCharacter(bundle);
}

/** @deprecated Use removePlayerCharacter */
export function clearPlayerBundle(): void {
  const roster = loadPlayerRoster();
  if (roster.activeUsername) {
    removePlayerCharacter(roster.activeUsername);
  }
}
