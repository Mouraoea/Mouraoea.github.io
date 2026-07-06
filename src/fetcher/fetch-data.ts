import path from "node:path";
import { stat } from "node:fs/promises";
import { fetchGameData } from "./api/game-data.ts";
import { fetchItemMap } from "./api/items.ts";
import {
  fetchAndStoreMarket,
  type FetchMarketOptions,
  type FetchMarketResult,
} from "./fetch-market.ts";
import {
  gameDataFilePath,
  writeGameDataArchive,
} from "./game-data-storage.ts";
import {
  buildSkillRecipeFiles,
  writeSkillRecipeFiles,
} from "../recipes/build-recipes.ts";
import type { SkillSlug } from "../recipes/types.ts";

export interface FetchDataOptions extends FetchMarketOptions {
  gameDataDir?: string;
  recipesDir?: string;
}

export interface FetchDataResult extends FetchMarketResult {
  gameDataPath: string;
  gameDataSizeBytes: number | null;
  recipePaths: string[];
  recipeCounts: Record<SkillSlug, number>;
}

export async function fetchAndStoreData(
  options: FetchDataOptions = {},
): Promise<FetchDataResult> {
  const now = options.now ?? new Date();
  const dryRun = options.dryRun ?? false;
  const capturedAt = now.toISOString();

  const marketResult = await fetchAndStoreMarket(options);

  const gameDataDir = path.resolve(
    options.gameDataDir ?? "./public/data/game",
  );
  const recipesDir = path.resolve(
    options.recipesDir ?? "./public/data/recipes",
  );
  const gameDataPath = gameDataFilePath(gameDataDir);

  const gameData = await fetchGameData();
  const itemMap = await fetchItemMap();
  const recipeFiles = buildSkillRecipeFiles(gameData, itemMap, capturedAt);

  const recipeCounts = Object.fromEntries(
    Object.entries(recipeFiles).map(([skill, file]) => [
      skill,
      file.recipes.length,
    ]),
  ) as Record<SkillSlug, number>;

  if (dryRun) {
    return {
      ...marketResult,
      gameDataPath,
      gameDataSizeBytes: null,
      recipePaths: Object.keys(recipeFiles).map(
        (skill) => path.join(recipesDir, `${skill}.json`),
      ),
      recipeCounts,
    };
  }

  await writeGameDataArchive(gameDataPath, gameData, capturedAt);
  const recipePaths = await writeSkillRecipeFiles(recipesDir, recipeFiles);
  const gameDataStat = await stat(gameDataPath);

  return {
    ...marketResult,
    gameDataPath,
    gameDataSizeBytes: gameDataStat.size,
    recipePaths,
    recipeCounts,
  };
}
