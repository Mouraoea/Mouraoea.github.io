import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { GameDataArchive } from "../recipes/types.ts";
import { validateGameDataArchive } from "../recipes/validate.ts";

export const GAME_DATA_FILENAME = "game-data.json";

export function gameDataFilePath(dataDir: string): string {
  return path.join(dataDir, GAME_DATA_FILENAME);
}

export async function readGameDataArchive(
  filePath: string,
): Promise<GameDataArchive | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    return validateGameDataArchive(parsed);
  } catch {
    return null;
  }
}

export async function writeGameDataArchive(
  filePath: string,
  data: Record<string, unknown>,
  capturedAt: string,
): Promise<GameDataArchive> {
  const archive: GameDataArchive = {
    version: 1,
    capturedAt,
    data,
  };

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(archive)}\n`, "utf8");
  return archive;
}
