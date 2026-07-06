import type { PlayerBundle } from "../bonuses/types.ts";

const STORAGE_KEY = "idleclans-player-bundle";

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

export function loadPlayerBundle(): PlayerBundle | null {
  if (typeof localStorage === "undefined") return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isPlayerBundle(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function savePlayerBundle(bundle: PlayerBundle): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bundle));
}

export function clearPlayerBundle(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
