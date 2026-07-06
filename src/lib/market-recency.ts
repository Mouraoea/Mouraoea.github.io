export const FETCH_COOLDOWN_MS = 6 * 60 * 60 * 1000;

export const LAST_FETCH_REQUEST_KEY = "idleclans-market-last-fetch-request";

export function isWithinCooldown(
  isoTimestamp: string | null | undefined,
  cooldownMs = FETCH_COOLDOWN_MS,
): boolean {
  if (!isoTimestamp) return false;
  const age = Date.now() - new Date(isoTimestamp).getTime();
  return age >= 0 && age < cooldownMs;
}

export function getLastFetchRequestAt(): string | null {
  return localStorage.getItem(LAST_FETCH_REQUEST_KEY);
}

export function recordFetchRequest(): void {
  localStorage.setItem(LAST_FETCH_REQUEST_KEY, new Date().toISOString());
}

export function clearFetchRequest(): void {
  localStorage.removeItem(LAST_FETCH_REQUEST_KEY);
}

export interface FetchCooldownContext {
  /** No archived file loaded — always allow retry. */
  noArchive?: boolean;
  /** Live preview already shown and still fresh. */
  liveCapturedAt?: string | null;
}

export function canRequestFetch(
  archiveCapturedAt: string | null | undefined,
  context: FetchCooldownContext = {},
): boolean {
  if (context.liveCapturedAt && isWithinCooldown(context.liveCapturedAt)) {
    return false;
  }

  if (context.noArchive) {
    return true;
  }

  if (isWithinCooldown(archiveCapturedAt)) return false;
  if (isWithinCooldown(getLastFetchRequestAt())) return false;
  return true;
}

export function shouldShowForceFetchButton(
  archiveCapturedAt: string | null | undefined,
  hasArchiveError: boolean,
  liveCapturedAt?: string | null,
): boolean {
  if (liveCapturedAt && isWithinCooldown(liveCapturedAt)) {
    return false;
  }

  if (hasArchiveError && !archiveCapturedAt) {
    return true;
  }

  return !isWithinCooldown(archiveCapturedAt);
}
