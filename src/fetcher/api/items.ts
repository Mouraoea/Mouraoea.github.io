import { ITEMS_API_URL } from "../config.ts";
import type { ItemCatalogEntry } from "../types.ts";

export async function fetchItemMap(): Promise<Record<number, string>> {
  const response = await fetch(ITEMS_API_URL, { method: "GET" });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Items HTTP Error ${response.status}`);
  }

  const items: unknown = await response.json();
  if (!Array.isArray(items)) {
    throw new Error("Items API returned unexpected format");
  }

  const map: Record<number, string> = {};
  for (const entry of items as ItemCatalogEntry[]) {
    const key =
      typeof entry.internal_id === "number"
        ? entry.internal_id
        : parseInt(String(entry.internal_id), 10);
    if (!Number.isNaN(key)) {
      map[key] = entry.name_id || "";
    }
  }

  return map;
}
