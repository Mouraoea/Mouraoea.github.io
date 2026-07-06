import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { MarketItemRow, MonthlyArchive } from "../fetcher/types.ts";
import {
  currentMonthKey,
  loadMonthlyArchive,
} from "../lib/market-archive.ts";
import "./MarketDataPage.css";

const COLUMN_KEYS = [
  "itemId",
  "name_id",
  "lowestSellPrice",
  "lowestPriceVolume",
  "highestBuyPrice",
  "highestPriceVolume",
  "history_1d",
  "history_7d",
  "history_30d",
  "history_1y",
  "tradeVolume1Day",
] as const satisfies readonly (keyof MarketItemRow)[];

function formatCell(value: string | number | null): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

export function MarketDataPage() {
  const { t } = useTranslation(["market", "common"]);
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
        <h1>{t("market:title")}</h1>
        <p
          className="market-subtitle"
          dangerouslySetInnerHTML={{ __html: t("market:subtitle") }}
        />
      </header>

      <section className="market-controls">
        <label>
          {t("common:labels.month")}
          <input type="text" value={month} readOnly />
        </label>

        <label>
          {t("common:labels.snapshot")}
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
          {t("common:labels.search")}
          <input
            type="search"
            placeholder={t("market:searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        <button type="button" onClick={() => void loadArchive(true)} disabled={loading}>
          {t("common:actions.refresh")}
        </button>
      </section>

      {loading && <p className="market-status">{t("market:loading")}</p>}
      {error && <p className="market-error">{error}</p>}

      {!loading && !error && selectedSnapshot && (
        <>
          <p className="market-meta">
            {t("common:meta.capturedAt")}{" "}
            <time dateTime={selectedSnapshot.capturedAt}>
              {selectedSnapshot.capturedAt}
            </time>
            {" · "}
            {t("market:itemCount", {
              filtered: filteredItems.length,
              total: selectedSnapshot.items.length,
            })}
          </p>

          <div className="market-table-wrap">
            <table className="market-table">
              <thead>
                <tr>
                  {COLUMN_KEYS.map((key) => (
                    <th key={key}>{t(`market:columns.${key}`)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.itemId}>
                    {COLUMN_KEYS.map((key) => (
                      <td key={key}>{formatCell(item[key])}</td>
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
