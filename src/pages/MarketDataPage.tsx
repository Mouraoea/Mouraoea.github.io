import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { MarketItemDetailModal } from "../components/MarketItemDetailModal.tsx";
import { useAppLocale } from "../components/LanguageSwitcher.tsx";
import type { MarketItemRow, MonthlyArchive } from "../fetcher/types.ts";
import { translateNameId } from "../i18n/game-labels.ts";
import { formatCompactNumber } from "../lib/format-compact-number.ts";
import {
  changeChevron,
  compute24hChange,
  formatPercentChange,
  priceChangeDirection,
  type PriceChangeDirection,
} from "../lib/market-price-change.ts";
import {
  currentMonthKey,
  loadMonthlyArchive,
} from "../lib/market-archive.ts";
import "./MarketDataPage.css";

const TABLE_COLUMNS = ["item", "bid", "ask", "prevClose"] as const;
type TableColumn = (typeof TABLE_COLUMNS)[number];

function isVisibleMarketItem(item: MarketItemRow): boolean {
  return item.itemId !== -1;
}

function formatPrice(value: number | null, locale: string): string {
  if (value === null || value === undefined) return "—";
  return formatCompactNumber(value, locale);
}

function changeClassName(direction: PriceChangeDirection): string {
  switch (direction) {
    case "up":
      return "market-change--up";
    case "down":
      return "market-change--down";
    case "flat":
      return "market-change--flat";
  }
}

function PriceWithDelta({
  price,
  prevClose,
  locale,
}: {
  price: number;
  prevClose: number | null;
  locale: string;
}) {
  const change = compute24hChange(price, prevClose);
  const direction = priceChangeDirection(change);
  const className = changeClassName(direction);

  if (change === null) {
    return (
      <span className="market-price-line market-change--flat">
        <span className="market-price-value">{formatPrice(price, locale)}</span>
      </span>
    );
  }

  return (
    <span className={`market-price-line ${className}`.trim()}>
      <span className="market-price-value">{formatPrice(price, locale)}</span>
      <span className="market-price-delta">
        {" "}
        ({formatPercentChange(change, locale)}{" "}
        <span className="market-price-chevron" aria-hidden>
          {changeChevron(direction)}
        </span>
        )
      </span>
    </span>
  );
}

export function MarketDataPage() {
  const { t } = useTranslation(["market", "common"]);
  const locale = useAppLocale();
  const [archive, setArchive] = useState<MonthlyArchive | null>(null);
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<MarketItemRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const month = currentMonthKey();

  const loadArchive = useCallback(async (bustCache = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadMonthlyArchive(month, { bustCache });
      setArchive(data);
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

  const latestSnapshot = useMemo(
    () => archive?.snapshots.at(-1) ?? null,
    [archive],
  );

  const filteredItems = useMemo(() => {
    if (!latestSnapshot) return [];
    const query = search.trim().toLowerCase();
    const visibleItems = latestSnapshot.items.filter(isVisibleMarketItem);

    if (!query) return visibleItems;

    return visibleItems.filter((item) => {
      const idMatch = String(item.itemId).includes(query);
      const nameIdMatch = item.name_id.toLowerCase().includes(query);
      const displayNameMatch = translateNameId(item.name_id)
        .toLowerCase()
        .includes(query);
      return idMatch || nameIdMatch || displayNameMatch;
    });
  }, [latestSnapshot, search]);

  function renderCell(item: MarketItemRow, column: TableColumn): ReactNode {
    switch (column) {
      case "item":
        return (
          <div className="market-cell-item">
            <span className="market-cell-name">{translateNameId(item.name_id)}</span>
            <span className="market-cell-meta">{item.name_id}</span>
          </div>
        );
      case "bid":
        return (
          <PriceWithDelta
            price={item.highestBuyPrice}
            prevClose={item.history_1d}
            locale={locale}
          />
        );
      case "ask":
        return (
          <PriceWithDelta
            price={item.lowestSellPrice}
            prevClose={item.history_1d}
            locale={locale}
          />
        );
      case "prevClose":
        return (
          <span className="market-price-line market-change--flat">
            <span className="market-price-value">{formatPrice(item.history_1d, locale)}</span>
          </span>
        );
    }
  }

  return (
    <main className="page">
      <header className="page-header">
        <h1>{t("market:title")}</h1>
      </header>

      <section className="control-bar">
        <label className="field">
          {t("common:labels.search")}
          <input
            type="search"
            placeholder={t("market:searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void loadArchive(true)}
          disabled={loading}
        >
          {t("common:actions.refresh")}
        </button>
      </section>

      {loading && <p className="status-text">{t("market:loading")}</p>}
      {error && <p className="status-error">{error}</p>}

      {!loading && !error && latestSnapshot && (
        <>
          <div className="table-wrap market-table-wrap">
            <table className="data-table market-table">
              <thead>
                <tr>
                  {TABLE_COLUMNS.map((column) => (
                    <th
                      key={column}
                      className={column === "item" ? "market-col-item" : "market-col-price"}
                    >
                      {t(`market:columns.${column}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const itemName = translateNameId(item.name_id);

                  return (
                    <tr
                      key={item.itemId}
                      className="market-row-clickable"
                      tabIndex={0}
                      role="button"
                      aria-label={t("market:rowDetails", { name: itemName })}
                      onClick={() => setSelectedItem(item)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedItem(item);
                        }
                      }}
                    >
                      {TABLE_COLUMNS.map((column) => (
                        <td
                          key={column}
                          className={
                            column === "item" ? "market-col-item" : "market-col-price"
                          }
                        >
                          {renderCell(item, column)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <MarketItemDetailModal
        item={selectedItem}
        archive={archive}
        onClose={() => setSelectedItem(null)}
      />
    </main>
  );
}
