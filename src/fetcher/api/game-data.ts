import { GAME_DATA_API_URL } from "../config.ts";

export function parseMongoExtendedJson(text: string): unknown {
  let normalized = text.replace(/ObjectId\("([^"]+)"\)/g, '"$1"');
  normalized = normalized.replace(/ISODate\("([^"]+)"\)/g, '"$1"');
  // Mongo shell dumps use NumberLong(123) / NumberLong("123"); JSON needs plain numbers.
  normalized = normalized.replace(
    /NumberLong\(\s*(?:"(-?\d+)"|(-?\d+))\s*\)/g,
    (_match, quoted, bare) => quoted ?? bare,
  );
  normalized = normalized.replace(
    /NumberInt\(\s*(?:"(-?\d+)"|(-?\d+))\s*\)/g,
    (_match, quoted, bare) => quoted ?? bare,
  );
  return JSON.parse(normalized);
}

export async function fetchGameDataRaw(): Promise<string> {
  const response = await fetch(GAME_DATA_API_URL, {
    method: "GET",
    headers: { Accept: "text/plain, application/json" },
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Game data HTTP Error ${response.status}`);
  }

  return response.text();
}

export async function fetchGameData(): Promise<Record<string, unknown>> {
  const raw = await fetchGameDataRaw();
  const parsed = parseMongoExtendedJson(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Game data API returned unexpected format");
  }
  return parsed as Record<string, unknown>;
}
