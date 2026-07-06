import { buildMarketHeaders } from "../config.ts";

const MAX_RETRIES = 6;
const RETRY_BASE_MS = 3000;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchJsonWithRetry(
  url: string,
  label: string,
): Promise<unknown> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, {
      method: "GET",
      headers: buildMarketHeaders(),
    });

    if (response.status === 429 && attempt < MAX_RETRIES) {
      await sleep(RETRY_BASE_MS * (attempt + 1));
      continue;
    }

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`${label} HTTP Error ${response.status}`);
    }

    return response.json();
  }

  throw new Error(`${label} HTTP Error 429`);
}
