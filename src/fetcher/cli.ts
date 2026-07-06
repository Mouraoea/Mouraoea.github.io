import { fetchAndStoreData } from "./fetch-data.ts";

function parseArgs(argv: string[]) {
  let dryRun = false;
  let marketDataDir = "./public/data/market";
  let gameDataDir = "./public/data/game";
  let recipesDir = "./public/data/recipes";

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--data-dir" && argv[i + 1]) {
      marketDataDir = argv[++i];
    } else if (arg === "--game-data-dir" && argv[i + 1]) {
      gameDataDir = argv[++i];
    } else if (arg === "--recipes-dir" && argv[i + 1]) {
      recipesDir = argv[++i];
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return { dryRun, marketDataDir, gameDataDir, recipesDir };
}

function printHelp() {
  console.log(`Usage: npm run fetch [-- --dry-run] [options]

Options:
  --dry-run               Fetch APIs and log summary without writing files
  --data-dir <path>       Market archive directory (default: ./public/data/market)
  --game-data-dir <path>  Game data directory (default: ./public/data/game)
  --recipes-dir <path>    Recipe output directory (default: ./public/data/recipes)
  -h, --help              Show this help
`);
}

async function main() {
  const { dryRun, marketDataDir, gameDataDir, recipesDir } = parseArgs(
    process.argv.slice(2),
  );

  try {
    const result = await fetchAndStoreData({
      dryRun,
      dataDir: marketDataDir,
      gameDataDir,
      recipesDir,
    });

    console.log(
      dryRun
        ? `[dry-run] Fetched ${result.itemCount} market items for ${result.date}`
        : `Stored market snapshot for ${result.date} (${result.itemCount} items)`,
    );
    console.log(`  month: ${result.month}`);
    console.log(`  market file: ${result.filePath}`);
    if (!dryRun) {
      console.log(`  snapshots in month: ${result.snapshotCount}`);
      console.log(`  market file size: ${result.fileSizeBytes} bytes`);
    }

    console.log(
      dryRun
        ? `[dry-run] Game data + recipes ready to write`
        : `Stored game data at ${result.gameDataPath}`,
    );
    if (!dryRun && result.gameDataSizeBytes !== null) {
      console.log(`  game data size: ${result.gameDataSizeBytes} bytes`);
    }

    console.log("  recipe counts:");
    for (const [skill, count] of Object.entries(result.recipeCounts)) {
      console.log(`    ${skill}: ${count}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Fetch failed: ${message}`);
    process.exit(1);
  }
}

main();
