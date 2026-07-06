import { useCallback, useEffect, useMemo, useState } from "react";
import type { MarketItemRow, MarketSnapshot, MonthlyArchive } from "../fetcher/types.ts";
import { fetchLiveMarketSnapshot } from "../lib/live-market.ts";
import {
  currentMonthKey,
  loadMonthlyArchive,
} from "../lib/market-archive.ts";
import {
  canRequestFetch,
  clearFetchRequest,
  isWithinCooldown,
  recordFetchRequest,
  shouldShowForceFetchButton,
} from "../lib/market-recency.ts";
import {
  dispatchMarketFetchWorkflow,
  isWorkflowDispatchConfigured,
} from "../lib/trigger-market-fetch.ts";
import "./MarketDataPage.css";

const COLUMNS: { key: keyof MarketItemRow; label: string }[] = [
  { key: "itemId", label: "itemId" },
  { key: "name_id", label: "name_id" },
  { key: "lowestSellPrice", label: "lowestSellPrice" },
  { key: "lowestPriceVolume", label: "lowestPriceVolume" },
  { key: "highestBuyPrice", label: "highestBuyPrice" },
  { key: "highestPriceVolume", label: "highestPriceVolume" },
  { key: "history_1d", label: "history_1d" },
  { key: "history_7d", label: "history_7d" },
  { key: "history_30d", label: "history_30d" },
  { key: "history_1y", label: "history_1y" },
  { key: "tradeVolume1Day", label: "tradeVolume1Day" },
];

function formatCell(value: string | number | null): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

export function MarketDataPage() {
  const [archive, setArchive] = useState<MonthlyArchive | null>(null);
  const [liveSnapshot, setLiveSnapshot] = useState<MarketSnapshot | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchMessage, setFetchMessage] = useState<string | null>(null);

  const month = currentMonthKey();

  const loadArchive = useCallback(async (bustCache = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadMonthlyArchive(month, { bustCache });
      setArchive(data);
      setLiveSnapshot(null);
      const latest = data.snapshots.at(-1);
      setSelectedDate((prev) => {
        if (prev && data.snapshots.some((s) => s.date === prev)) return prev;
        return latest?.date ?? "";
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setArchive(null);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void loadArchive();
  }, [loadArchive]);

  const latestArchiveSnapshot = archive?.snapshots.at(-1);
  const latestCapturedAt = latestArchiveSnapshot?.capturedAt ?? null;
  const noArchive = !archive;
  const liveCapturedAt = liveSnapshot?.capturedAt ?? null;

  const showForceFetch = shouldShowForceFetchButton(
    latestCapturedAt,
    Boolean(error && !archive && !liveSnapshot),
    liveCapturedAt,
  );

  const selectedSnapshot = useMemo(() => {
    if (liveSnapshot) return liveSnapshot;
    return archive?.snapshots.find((s) => s.date === selectedDate);
  }, [archive, liveSnapshot, selectedDate]);

  const filteredItems = useMemo(() => {
    if (!selectedSnapshot) return [];
    const query = search.trim().toLowerCase();
    if (!query) return selectedSnapshot.items;

    return selectedSnapshot.items.filter((item) => {
      const idMatch = String(item.itemId).includes(query);
      const nameMatch = item.name_id.toLowerCase().includes(query);
      return idMatch || nameMatch;
    });
  }, [selectedSnapshot, search]);

  const handleForceFetch = useCallback(async () => {
    const fetchContext = { noArchive, liveCapturedAt };

    if (!canRequestFetch(latestCapturedAt, fetchContext)) {
      setFetchMessage("Market data was fetched recently. Try again in a few hours.");
      return;
    }

    setFetching(true);
    setFetchMessage(null);
    setError(null);

    try {
      if (isWorkflowDispatchConfigured()) {
        await dispatchMarketFetchWorkflow();
        recordFetchRequest();
        setFetchMessage(
          "Fetch started on GitHub Actions. Reloading archive when ready…",
        );

        for (let attempt = 0; attempt < 15; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 20_000));
          try {
            const data = await loadMonthlyArchive(month, { bustCache: true });
            const latest = data.snapshots.at(-1);
            if (latest && isWithinCooldown(latest.capturedAt)) {
              setArchive(data);
              setLiveSnapshot(null);
              setSelectedDate(latest.date);
              setFetchMessage("Archive updated with fresh market data.");
              return;
            }
          } catch {
            // keep polling until attempts exhausted
          }
        }

        setFetchMessage(
          "Workflow triggered. Archive may take a few minutes — use Refresh to check again.",
        );
        return;
      }

      const snapshot = await fetchLiveMarketSnapshot();
      setLiveSnapshot(snapshot);
      setSelectedDate(snapshot.date);
      setError(null);
      recordFetchRequest();
      setFetchMessage(
        "Showing live market data (not saved to archive). Configure VITE_GITHUB_DISPATCH_TOKEN to persist via GitHub Actions.",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      clearFetchRequest();
      setError(message);
    } finally {
      setFetching(false);
    }
  }, [latestCapturedAt, liveCapturedAt, month, noArchive]);

  return (
    <main className="market-page">
      <header className="market-header">
        <h1>IdleClans Market Data</h1>
        <p className="market-subtitle">
          Archived snapshots from <code>public/data/market/</code>
        </p>
      </header>

      <section className="market-controls">
        <label>
          Month
          <input type="text" value={month} readOnly />
        </label>

        <label>
          Snapshot
          <select
            value={selectedDate}
            onChange={(e) => {
              setLiveSnapshot(null);
              setSelectedDate(e.target.value);
            }}
            disabled={!archive?.snapshots.length && !liveSnapshot}
          >
            {liveSnapshot && (
              <option value={liveSnapshot.date}>
                {liveSnapshot.date} (live)
              </option>
            )}
            {archive?.snapshots.map((snapshot) => (
              <option key={snapshot.date} value={snapshot.date}>
                {snapshot.date}
              </option>
            ))}
          </select>
        </label>

        <label>
          Search
          <input
            type="search"
            placeholder="name_id or itemId"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        <button type="button" onClick={() => void loadArchive(true)} disabled={loading}>
          Refresh
        </button>

        {showForceFetch && (
          <button
            type="button"
            className="market-force-fetch"
            onClick={() => void handleForceFetch()}
            disabled={loading || fetching}
          >
            {fetching ? "Fetching…" : "Fetch market data"}
          </button>
        )}
      </section>

      {loading && <p className="market-status">Loading archive…</p>}
      {error && !liveSnapshot && <p className="market-error">{error}</p>}
      {fetchMessage && <p className="market-info">{fetchMessage}</p>}

      {!loading && selectedSnapshot && (
        <>
          <p className="market-meta">
            {liveSnapshot ? (
              <span className="market-live-badge">Live preview</span>
            ) : null}
            Captured at{" "}
            <time dateTime={selectedSnapshot.capturedAt}>
              {selectedSnapshot.capturedAt}
            </time>
            {" · "}
            {filteredItems.length} of {selectedSnapshot.items.length} items
          </p>

          <div className="market-table-wrap">
            <table className="market-table">
              <thead>
                <tr>
                  {COLUMNS.map((col) => (
                    <th key={col.key}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.itemId}>
                    {COLUMNS.map((col) => (
                      <td key={col.key}>{formatCell(item[col.key])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
