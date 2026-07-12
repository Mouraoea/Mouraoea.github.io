import { readFile } from "node:fs/promises";
import {
  compressJsonToText,
  decompressTextToJson,
  formatCompressedFile,
  stripCommentLines,
} from "../lib/compression.ts";
import { upsertSnapshot } from "../lib/storage.ts";
import type { MonthlyArchive } from "./types.ts";

const sample: MonthlyArchive = {
  version: 1,
  month: "2026-07",
  snapshots: [
    {
      date: "2026-07-06",
      capturedAt: "2026-07-06T12:00:00.000Z",
      items: [
        {
          itemId: 1,
          name_id: "iron_ore",
          lowestSellPrice: 10,
          lowestPriceVolume: 100,
          highestBuyPrice: 9,
          highestPriceVolume: 50,
          history_1d: 10,
          history_7d: 11,
          history_30d: 12,
          history_1y: 13,
          tradeVolume1Day: 1000,
        },
      ],
    },
  ],
};

const payload = compressJsonToText(sample);
const file = formatCompressedFile(payload);
const restored = decompressTextToJson<MonthlyArchive>(file);

const ok =
  JSON.stringify(restored) === JSON.stringify(sample) &&
  stripCommentLines(file).length > 0;

if (!ok) {
  console.error("Compression round-trip failed");
  process.exit(1);
}

console.log("Compression round-trip OK");

const updated = upsertSnapshot(restored, restored.snapshots[0]);
if (updated.snapshots.length !== 1) {
  console.error("Same capturedAt upsert idempotency failed");
  process.exit(1);
}

const duplicateDay = upsertSnapshot(updated, {
  ...restored.snapshots[0],
  capturedAt: "2026-07-06T18:00:00.000Z",
});
if (duplicateDay.snapshots.length !== 2) {
  console.error("Intraday snapshot append failed");
  process.exit(1);
}

console.log("Same-day upsert idempotency OK");

try {
  const live = await readFile("public/data/market/2026-07.txt", "utf-8");
  const archive = decompressTextToJson<MonthlyArchive>(live);
  console.log(
    `Live archive OK: ${archive.snapshots.length} snapshot(s), ${archive.snapshots.at(-1)?.items.length ?? 0} items`,
  );
} catch {
  console.log("Live archive file not present (skipped)");
}
