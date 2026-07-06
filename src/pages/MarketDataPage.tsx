import { useCallback, useEffect, useMemo, useState } from "react";
import type { MarketItemRow, MonthlyArchive } from "../fetcher/types.ts";
import {
  currentMonthKey,
  loadMonthlyArchive,
} from "../lib/market-archive.ts";
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
  const [selectedDate, setSelectedDate] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const month = currentMonthKey();

  const loadArchive = useCallback(async (bustCache = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadMonthlyArchive(month, { bustCache });
      setArchive(data);
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

  const selectedSnapshot = useMemo(
    () => archive?.snapshots.find((s) => s.date === selectedDate),
    [archive, selectedDate],
  );

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
            onChange={(e) => setSelectedDate(e.target.value)}
            disabled={!archive?.snapshots.length}
          >
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
      </section>

      {loading && <p className="market-status">Loading archive…</p>}
      {error && <p className="market-error">{error}</p>}

      {!loading && !error && selectedSnapshot && (
        <>
          <p className="market-meta">
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
