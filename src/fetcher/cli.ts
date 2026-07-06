import { fetchAndStoreMarket } from "./fetch-market.ts";

function parseArgs(argv: string[]) {
  let dryRun = false;
  let dataDir = "./public/data/market";

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--data-dir" && argv[i + 1]) {
      dataDir = argv[++i];
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return { dryRun, dataDir };
}

function printHelp() {
  console.log(`Usage: npm run fetch [-- --dry-run] [--data-dir <path>]

Options:
  --dry-run           Fetch APIs and log summary without writing files
  --data-dir <path>   Output directory (default: ./public/data/market)
  -h, --help          Show this help
`);
}

async function main() {
  const { dryRun, dataDir } = parseArgs(process.argv.slice(2));

  try {
    const result = await fetchAndStoreMarket({ dryRun, dataDir });

    console.log(
      dryRun
        ? `[dry-run] Fetched ${result.itemCount} items for ${result.date}`
        : `Stored snapshot for ${result.date} (${result.itemCount} items)`,
    );
    console.log(`  month: ${result.month}`);
    console.log(`  file:  ${result.filePath}`);
    if (!dryRun) {
      console.log(`  snapshots in month: ${result.snapshotCount}`);
      console.log(`  file size: ${result.fileSizeBytes} bytes`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Fetch failed: ${message}`);
    process.exit(1);
  }
}

main();
