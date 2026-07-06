function extractItemId(entry: unknown): number | null {
  if (!entry || typeof entry !== "object") return null;
  const record = entry as Record<string, unknown>;
  const rawId = record.itemId;
  if (typeof rawId === "number") return rawId;
  const parsed = parseInt(String(rawId), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function extractHistoryValue(entry: unknown): number | null {
  if (entry === null || entry === undefined) return null;

  if (typeof entry === "number") return entry;

  if (typeof entry === "string") {
    const parsed = parseFloat(entry);
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (Array.isArray(entry)) {
    if (!entry.length) return null;
    return extractHistoryValue(entry[entry.length - 1]);
  }

  if (typeof entry === "object") {
    const record = entry as Record<string, unknown>;
    const candidates = [
      "price",
      "avgPrice",
      "averagePrice",
      "close",
      "value",
      "lowestSellPrice",
      "highestBuyPrice",
    ];
    for (const key of candidates) {
      if (record[key] !== undefined && record[key] !== null) {
        return extractHistoryValue(record[key]);
      }
    }
  }

  return null;
}

export function normalizeHistoryResponse(
  data: unknown,
): Record<number, number | null> {
  const out: Record<number, number | null> = {};

  if (Array.isArray(data)) {
    for (const entry of data) {
      const id = extractItemId(entry);
      if (id === null) continue;
      out[id] = extractHistoryValue(entry);
    }
    return out;
  }

  if (data && typeof data === "object") {
    for (const key of Object.keys(data as Record<string, unknown>)) {
      const id = parseInt(key, 10);
      if (Number.isNaN(id)) continue;
      out[id] = extractHistoryValue(
        (data as Record<string, unknown>)[key],
      );
    }
  }

  return out;
}
