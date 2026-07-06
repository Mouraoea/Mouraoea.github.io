import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import {
  SKILL_DEFINITIONS,
  type SkillDefinition,
  type SkillTaskMode,
} from "./skills.ts";
import {
  RECIPE_FILE_VERSION,
  type GameTask,
  type Recipe,
  type RecipeIngredient,
  type RecipeSecondaryOutput,
  type SkillRecipeFile,
  type SkillSlug,
} from "./types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectTasksFromGroup(group: unknown): GameTask[] {
  if (!isRecord(group) || !Array.isArray(group.Items)) return [];

  const tasks: GameTask[] = [];
  for (const item of group.Items) {
    if (isRecord(item) && typeof item.Name === "string") {
      tasks.push(item as unknown as GameTask);
    }
  }
  return tasks;
}

function collectTasks(skillData: unknown): GameTask[] {
  if (Array.isArray(skillData)) {
    return skillData.flatMap((group) => collectTasksFromGroup(group));
  }
  if (!isRecord(skillData)) return [];

  const tasks: GameTask[] = [];
  for (const key of Object.keys(skillData)) {
    tasks.push(...collectTasksFromGroup(skillData[key]));
  }
  return tasks;
}

function getTasksForSkill(
  def: SkillDefinition,
  tasksRoot: Record<string, unknown>,
): GameTask[] {
  if (def.splitFrom) {
    const source = collectTasks(tasksRoot[def.splitFrom.tasksKey]);
    return source.filter((task) => def.splitFrom!.predicate(task.Name));
  }

  if (!def.tasksKey) return [];

  let items = collectTasks(tasksRoot[def.tasksKey]);
  if (def.tasksKey === "Smithing" && def.slug === "smithing") {
    items = items.filter((task) => !task.Name.endsWith("_bar"));
  }
  return items;
}

function toDisplayName(nameId: string): string {
  return nameId
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function resolveItemName(
  itemId: number,
  itemMap: Record<number, string>,
): string | null {
  const name = itemMap[itemId];
  return name && name.length > 0 ? name : null;
}

function taskMatchesMode(task: GameTask, mode: SkillTaskMode): boolean {
  const hasCosts = Boolean(task.Costs?.length);
  if (mode === "craft") return hasCosts;
  if (mode === "gathering") return !hasCosts;
  return true;
}

function mapTaskToRecipe(
  task: GameTask,
  itemMap: Record<number, string>,
  mode: SkillTaskMode,
): Recipe | null {
  if (task.Disabled || task.Hidden) return null;
  if (!taskMatchesMode(task, mode)) return null;
  if (task.ItemReward < 0 || task.ItemAmount <= 0) return null;

  const product = resolveItemName(task.ItemReward, itemMap);
  if (!product) return null;

  const ingredients: RecipeIngredient[] = [];
  if (task.Costs?.length) {
    for (const cost of task.Costs) {
      const item = resolveItemName(cost.Item, itemMap);
      if (!item) return null;
      ingredients.push({ item, quantity: cost.Amount });
    }
  }

  let secondaryOutput: RecipeSecondaryOutput | null = null;
  if (
    typeof task.SecondaryItemReward === "number" &&
    task.SecondaryItemReward >= 0 &&
    typeof task.SecondaryItemAmount === "number" &&
    task.SecondaryItemAmount > 0
  ) {
    const secondaryItem = resolveItemName(task.SecondaryItemReward, itemMap);
    if (secondaryItem) {
      secondaryOutput = {
        item: secondaryItem,
        quantity: task.SecondaryItemAmount,
      };
    }
  }

  return {
    id: task.Name,
    displayName: toDisplayName(product),
    product,
    baseTimeSeconds: task.BaseTime / 1000,
    outputAmount: task.ItemAmount,
    secondaryOutput,
    ingredients,
    levelRequired: task.LevelRequirement,
    xp: task.ExpReward,
  };
}

export function buildSkillRecipeFiles(
  gameData: Record<string, unknown>,
  itemMap: Record<number, string>,
  capturedAt: string,
): Record<SkillSlug, SkillRecipeFile> {
  const tasksRoot = isRecord(gameData.Tasks) ? gameData.Tasks : {};
  const result = {} as Record<SkillSlug, SkillRecipeFile>;

  for (const def of SKILL_DEFINITIONS) {
    const tasks = getTasksForSkill(def, tasksRoot);
    const recipes: Recipe[] = [];

    for (const task of tasks) {
      const recipe = mapTaskToRecipe(task, itemMap, def.mode);
      if (recipe) recipes.push(recipe);
    }

    recipes.sort((a, b) => a.id.localeCompare(b.id));

    result[def.slug] = {
      skill: def.slug,
      version: RECIPE_FILE_VERSION,
      source: "official-game-data",
      capturedAt,
      recipes,
    };
  }

  return result;
}

export async function writeSkillRecipeFiles(
  recipesDir: string,
  files: Record<SkillSlug, SkillRecipeFile>,
): Promise<string[]> {
  await mkdir(recipesDir, { recursive: true });
  const written: string[] = [];

  for (const [skill, file] of Object.entries(files)) {
    const filePath = path.join(recipesDir, `${skill}.json`);
    await writeFile(filePath, `${JSON.stringify(file, null, 2)}\n`, "utf8");
    written.push(filePath);
  }

  return written;
}
