import { readFile } from "node:fs/promises";
import { validateGameDataArchive } from "../src/recipes/validate.ts";

const raw = await readFile("./public/data/game/game-data.json", "utf8");
const archive = validateGameDataArchive(JSON.parse(raw))!;
const data = archive.data;

console.log("Upgrades type", Array.isArray(data.Upgrades), typeof data.Upgrades);
if (Array.isArray(data.Upgrades)) {
  console.log("Upgrades count", data.Upgrades.length);
  console.log("sample upgrade", JSON.stringify(data.Upgrades[0], null, 2).slice(0, 2500));
}

console.log("\nClanUpgrades type", Array.isArray(data.ClanUpgrades), typeof data.ClanUpgrades);
if (Array.isArray(data.ClanUpgrades)) {
  console.log("ClanUpgrades count", data.ClanUpgrades.length);
  console.log("sample", JSON.stringify(data.ClanUpgrades[0], null, 2).slice(0, 2500));
}

// try player API with a common name
const names = ["Bob", "Test", "Idle"];
for (const name of names) {
  const res = await fetch(`https://query.idleclans.com/api/Player/profile/${encodeURIComponent(name)}`);
  console.log(`\nPlayer ${name}:`, res.status);
  if (res.ok) {
    const p = await res.json();
    console.log("keys", Object.keys(p));
    console.log("upgrades", JSON.stringify(p.upgrades, null, 2)?.slice(0, 1500));
    console.log("enchantmentBoosts", JSON.stringify(p.enchantmentBoosts, null, 2)?.slice(0, 800));
    if (p.guildName) {
      const cr = await fetch(`https://query.idleclans.com/api/Clan/recruitment/${encodeURIComponent(p.guildName)}`);
      console.log("clan recruitment", cr.status);
      if (cr.ok) {
        const c = await cr.json();
        console.log("clan keys", Object.keys(c));
        console.log("serializedUpgrades", c.serializedUpgrades?.slice?.(0, 200));
        console.log("repeatableUpgradeCounts", c.repeatableUpgradeCounts);
      }
    }
    break;
  }
}
