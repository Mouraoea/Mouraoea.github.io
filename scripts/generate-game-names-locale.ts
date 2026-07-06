import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const RECIPES_DIR = path.join(ROOT, "public", "data", "recipes");
const LOCALES_DIR = path.join(ROOT, "src", "locales");

function toDisplayName(nameId: string): string {
  return nameId
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

interface RecipeJson {
  recipes?: Array<{
    id: string;
    displayName?: string;
    product: string;
    ingredients?: Array<{ item: string }>;
    secondaryOutput?: { item: string } | null;
  }>;
}

async function collectNameIds(): Promise<Set<string>> {
  const names = new Set<string>();
  const files = await readdir(RECIPES_DIR);

  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const content = await readFile(path.join(RECIPES_DIR, file), "utf-8");
    const data = JSON.parse(content) as RecipeJson;

    for (const recipe of data.recipes ?? []) {
      names.add(recipe.id);
      names.add(recipe.product);
      for (const ingredient of recipe.ingredients ?? []) {
        names.add(ingredient.item);
      }
      if (recipe.secondaryOutput) {
        names.add(recipe.secondaryOutput.item);
      }
    }
  }

  return names;
}

async function buildEnglishNames(): Promise<Record<string, string>> {
  const names = await collectNameIds();
  const displayNames = new Map<string, string>();
  const files = await readdir(RECIPES_DIR);

  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const content = await readFile(path.join(RECIPES_DIR, file), "utf-8");
    const data = JSON.parse(content) as RecipeJson;

    for (const recipe of data.recipes ?? []) {
      if (recipe.displayName) {
        displayNames.set(recipe.id, recipe.displayName);
      }
    }
  }

  const result: Record<string, string> = {};
  for (const nameId of [...names].sort()) {
    result[nameId] = displayNames.get(nameId) ?? toDisplayName(nameId);
  }
  return result;
}

async function readExistingLocale(
  locale: string,
): Promise<Record<string, string>> {
  const filePath = path.join(LOCALES_DIR, locale, "game-names.json");
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as Record<string, string>;
  } catch {
    return {};
  }
}

async function writeLocale(
  locale: string,
  names: Record<string, string>,
): Promise<void> {
  const dir = path.join(LOCALES_DIR, locale);
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, "game-names.json");
  const sorted = Object.fromEntries(
    Object.entries(names).sort(([a], [b]) => a.localeCompare(b)),
  );
  await writeFile(filePath, `${JSON.stringify(sorted, null, 2)}\n`, "utf-8");
  console.log(`Wrote ${Object.keys(sorted).length} entries to ${filePath}`);
}

async function main(): Promise<void> {
  const english = await buildEnglishNames();
  await writeLocale("en", english);

  const existingPt = await readExistingLocale("pt-BR");
  const ptBr: Record<string, string> = { ...existingPt };
  for (const [key, value] of Object.entries(english)) {
    if (!(key in ptBr)) {
      ptBr[key] = value;
    }
  }
  await writeLocale("pt-BR", ptBr);
}

void main();
