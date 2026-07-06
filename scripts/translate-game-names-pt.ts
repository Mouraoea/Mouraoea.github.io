import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const WORD_MAP: Record<string, string> = {
  raw: "cru",
  cooked: "cozido",
  ancient: "antigo",
  astronomical: "astronômico",
  basilisk: "basilisco",
  black: "preto",
  blessed: "abençoado",
  bloodmoon: "lua de sangue",
  blueberry: "mirtilo",
  blueberries: "mirtilo",
  bronze: "bronze",
  bulwark: "baluarte",
  cabbage: "repolho",
  carrot: "cenoura",
  chestnut: "castanha",
  coal: "carvão",
  cod: "bacalhau",
  copper: "cobre",
  cursed: "amaldiçoado",
  diamond: "diamante",
  dragon: "dragão",
  emerald: "esmeralda",
  enchanted: "encantado",
  ethereal: "etéreo",
  flax: "linho",
  giant: "gigante",
  gold: "ouro",
  granite: "granito",
  iron: "ferro",
  leather: "couro",
  magical: "mágico",
  mackerel: "cavala",
  mahogany: "mogno",
  maple: "bordo",
  meat: "carne",
  oak: "carvalho",
  obsidian: "obsidiana",
  perch: "perca",
  piranha: "piranha",
  platinum: "platina",
  potato: "batata",
  pufferfish: "baiacu",
  quality: "qualidade",
  salmon: "salmão",
  sapphire: "safira",
  silver: "prata",
  steel: "aço",
  superior: "superior",
  titanium: "titânio",
  trout: "truta",
  tuna: "atum",
  willow: "salgueiro",
  wolf: "lobo",
  zander: "zander",
  apex: "ápice",
  anglerfish: "tamboril",
  arrow: "flecha",
  bar: "barra",
  ore: "minério",
  helmet: "capacete",
  shield: "escudo",
  platebody: "peitoral",
  platelegs: "coxal",
  robe: "manto",
  trousers: "calças",
  coat: "casaco",
  amulet: "amuleto",
  ring: "anel",
  bracelet: "bracelete",
  earrings: "brincos",
  symbol: "símbolo",
  string: "corda",
  scale: "escama",
  hide: "couro",
  worm: "verme",
  eel: "enguia",
  pie: "torta",
  soup: "sopa",
  seed: "semente",
  log: "tora",
  plank: "tábua",
  crossbow: "besta",
  arcane: "arcano",
  berserker: "berserker",
  brute: "bruto",
  marksman: "atirador",
  crocodile: "crocodilo",
  fur: "pele",
  hat: "chapéu",
  shirt: "camisa",
  pants: "calças",
  shorts: "shorts",
  jacket: "jaqueta",
  cap: "touca",
  pan: "panela",
  needle: "agulha",
  stone: "pedra",
  philosopher: "filósofo",
  philosophers: "filósofo",
  carp: "carpa",
};

const SUFFIX_PATTERNS: Array<{ suffix: string; template: (base: string) => string }> = [
  { suffix: " bar", template: (b) => `Barra de ${b}` },
  { suffix: " ore", template: (b) => `Minério de ${b}` },
  { suffix: " helmet", template: (b) => `Capacete de ${b}` },
  { suffix: " shield", template: (b) => `Escudo de ${b}` },
  { suffix: " arrow", template: (b) => `Flecha de ${b}` },
  { suffix: " amulet", template: (b) => `Amuleto de ${b}` },
  { suffix: " ring", template: (b) => `Anel de ${b}` },
  { suffix: " bracelet", template: (b) => `Bracelete de ${b}` },
  { suffix: " earrings", template: (b) => `Brincos de ${b}` },
  { suffix: " symbol", template: (b) => `Símbolo de ${b}` },
  { suffix: " seed", template: (b) => `Semente de ${b}` },
  { suffix: " log", template: (b) => `Tora de ${b}` },
  { suffix: " plank", template: (b) => `Tábua de ${b}` },
  { suffix: " pie", template: (b) => `Torta de ${b}` },
  { suffix: " soup", template: (b) => `Sopa de ${b}` },
  { suffix: " platebody", template: (b) => `Peitoral de ${b}` },
  { suffix: " platelegs", template: (b) => `Coxal de ${b}` },
  { suffix: " robe", template: (b) => `Manto de ${b}` },
  { suffix: " trousers", template: (b) => `Calças de ${b}` },
  { suffix: " coat", template: (b) => `Casaco de ${b}` },
  { suffix: " leather", template: (b) => `Couro de ${b}` },
  { suffix: " leather coat", template: (b) => `Casaco de Couro ${b}` },
  { suffix: " leather trousers", template: (b) => `Calças de Couro ${b}` },
  { suffix: " scale", template: (b) => `Escama de ${b}` },
  { suffix: " scale coat", template: (b) => `Casaco de Escama de ${b}` },
  { suffix: " scale trousers", template: (b) => `Calças de Escama de ${b}` },
  { suffix: " hide", template: (b) => `Couro de ${b}` },
  { suffix: " flax", template: (b) => `Linho ${b}` },
  { suffix: " string", template: (b) => `Corda de ${b}` },
];

const PHRASE_MAP: Record<string, string> = {
  "Blueberry Pie": "Torta de Mirtilo",
  "Cod Soup": "Sopa de Bacalhau",
  "Raw Cod": "Bacalhau Cru",
  "Raw Carp": "Carpa Crua",
  "Raw Anglerfish": "Tamboril Cru",
  "Raw Salmon": "Salmão Cru",
  "Raw Trout": "Truta Crua",
  "Raw Tuna": "Atum Cru",
  "Raw Mackerel": "Cavala Crua",
  "Raw Perch": "Perca Crua",
  "Raw Piranha": "Piranha Crua",
  "Raw Zander": "Zander Cru",
  "Cooked Cod": "Bacalhau Cozido",
  "Cooked Carp": "Carpa Cozida",
  "Cooked Anglerfish": "Tamboril Cozido",
  "Cooked Salmon": "Salmão Cozido",
  "Cooked Trout": "Truta Cozida",
  "Cooked Tuna": "Atum Cozido",
  "Cooked Mackerel": "Cavala Cozida",
  "Cooked Perch": "Perca Cozida",
  "Cooked Piranha": "Piranha Cozida",
  "Cooked Zander": "Zander Cozido",
  "Cooked Meat": "Carne Cozida",
  "Cooked Quality Meat": "Carne de Qualidade Cozida",
  "Cooked Superior Meat": "Carne Superior Cozida",
  "Cooked Giant Meat": "Carne Gigante Cozida",
  "Cooked Apex Meat": "Carne de Ápice Cozida",
  "Cooked Bloodmoon Eel": "Enguia da Lua de Sangue Cozida",
  "Cooked Pufferfish": "Baiacu Cozido",
  "Bloodmoon Eel": "Enguia da Lua de Sangue",
  "Bloodmoon Worm": "Verme da Lua de Sangue",
  "Philosopher's Stone": "Pedra Filosofal",
  "Ancient Crossbow String": "Corda de Besta Antiga",
  "Chestnut Log": "Tora de Castanha",
  "Coal Ore": "Minério de Carvão",
  "Copper Ore": "Minério de Cobre",
  "Iron Ore": "Minério de Ferro",
  "Gold Ore": "Minério de Ouro",
  "Silver Ore": "Minério de Prata",
  "Diamond Ore": "Minério de Diamante",
  "Emerald Ore": "Minério de Esmeralda",
  "Sapphire Ore": "Minério de Safira",
  "Platinum Ore": "Minério de Platina",
  "Titanium Ore": "Minério de Titânio",
  "Obsidian Ore": "Minério de Obsidiana",
  "Bronze Bar": "Barra de Bronze",
  "Iron Bar": "Barra de Ferro",
  "Steel Bar": "Barra de Aço",
  "Gold Bar": "Barra de Ouro",
  "Silver Bar": "Barra de Prata",
  "Diamond Bar": "Barra de Diamante",
  "Cabbage Seed": "Semente de Repolho",
  "Carrot Seed": "Semente de Cenoura",
  "Potato Seed": "Semente de Batata",
  "Blessed Crocodile Hide": "Couro de Crocodilo Abençoado",
  "Basilisk Scale": "Escama de Basilisco",
  "Basilisk Scale Coat": "Casaco de Escama de Basilisco",
  "Basilisk Scale Trousers": "Calças de Escama de Basilisco",
  "Black Leather": "Couro Preto",
  "Black Leather Coat": "Casaco de Couro Preto",
  "Black Leather Trousers": "Calças de Couro Preto",
  "Astronomical Arrow": "Flecha Astronômica",
  "Bronze Arrow": "Flecha de Bronze",
  "Blueberry": "Mirtilo",
};

function capitalize(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function translateWord(word: string): string {
  const lower = word.toLowerCase();
  return WORD_MAP[lower] ?? word;
}

function translateWords(english: string): string {
  if (PHRASE_MAP[english]) return PHRASE_MAP[english];

  const lower = english.toLowerCase();
  if (lower.startsWith("raw ")) {
    const rest = translateWords(english.slice(4));
    return `${rest} Cru${rest.endsWith("a") ? "a" : ""}`;
  }
  if (lower.startsWith("cooked ")) {
    const rest = translateWords(english.slice(7));
    return `${rest} Cozid${rest.endsWith("a") ? "a" : "o"}`;
  }

  for (const { suffix, template } of SUFFIX_PATTERNS) {
    if (lower.endsWith(suffix)) {
      const base = english.slice(0, -suffix.length).trim();
      const translatedBase = base
        .split(" ")
        .map((word) => capitalize(translateWord(word)))
        .join(" ");
      return template(translatedBase);
    }
  }

  const words = english.split(" ");
  const translated = words.map((word) => {
    const pt = translateWord(word);
    if (word[0] === word[0].toUpperCase()) {
      return capitalize(pt);
    }
    return pt;
  });

  return translated.join(" ");
}

async function main(): Promise<void> {
  const enPath = path.join(ROOT, "src", "locales", "en", "game-names.json");
  const ptPath = path.join(ROOT, "src", "locales", "pt-BR", "game-names.json");

  const english = JSON.parse(await readFile(enPath, "utf-8")) as Record<
    string,
    string
  >;

  const portuguese: Record<string, string> = {};
  for (const [key, value] of Object.entries(english)) {
    portuguese[key] = translateWords(value);
  }

  const sorted = Object.fromEntries(
    Object.entries(portuguese).sort(([a], [b]) => a.localeCompare(b)),
  );

  await writeFile(ptPath, `${JSON.stringify(sorted, null, 2)}\n`, "utf-8");
  console.log(`Translated ${Object.keys(sorted).length} entries to ${ptPath}`);
}

void main();
