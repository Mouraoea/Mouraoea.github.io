import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { MarketItemDetailModal } from "../components/MarketItemDetailModal.tsx";
import { useAppLocale } from "../components/LanguageSwitcher.tsx";
import type { MarketItemRow, MonthlyArchive } from "../fetcher/types.ts";
import { translateNameId } from "../i18n/game-labels.ts";
import { formatCompactNumber } from "../lib/format-compact-number.ts";
import {
  changeChevron,
  formatPercentChange,
  priceChangeDirection,
  type PriceChangeDirection,
} from "../lib/market-price-change.ts";
import {
  buildResolvedPricesMap,
  type ResolvedItemPrices,
} from "../lib/market-price-sanitize.ts";
import {
  COLUMN_SORT_SEQUENCE,
  DEFAULT_MARKET_SORT,
  isSortKeyInColumn,
  nextSortState,
  sortMarketItems,
  type MarketSortKey,
  type MarketTableColumn,
  type SortDirection,
} from "../lib/market-table-sort.ts";
import {
  currentMonthKey,
  loadMonthlyArchive,
} from "../lib/market-archive.ts";
import "./MarketDataPage.css";

const TABLE_COLUMNS = ["item", "bid", "ask", "prevClose"] as const satisfies readonly MarketTableColumn[];
type TableColumn = (typeof TABLE_COLUMNS)[number];

function isVisibleMarketItem(item: MarketItemRow): boolean {
  return item.itemId !== -1;
}

function formatPrice(value: number | null, locale: string): string {
  if (value === null || value === undefined || value <= 0) return "—";
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
  change,
  locale,
}: {
  price: number | null;
  change: number | null;
  locale: string;
}) {
  const direction = priceChangeDirection(change);
  const className = changeClassName(direction);

  if (price === null) {
    return (
      <span className="market-price-line market-change--flat market-price-line--empty">
        <span className="market-price-value">{formatPrice(price, locale)}</span>
      </span>
    );
  }

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

function sortIndicator(direction: SortDirection): string {
  return direction === "asc" ? "↑" : "↓";
}

function SortableHeader({
  column,
  label,
  sortKey,
  sortLabel,
  sortDirection,
  onSort,
}: {
  column: TableColumn;
  label: string;
  sortKey: MarketSortKey;
  sortLabel: string;
  sortDirection: SortDirection;
  onSort: (column: TableColumn) => void;
}) {
  const active = isSortKeyInColumn(column, sortKey);
  let displayLabel = label;
  if (active) {
    if (sortKey === "bidDelta" || sortKey === "askDelta") {
      displayLabel = `${label} Δ`;
    } else if (sortKey === "itemId") {
      displayLabel = "#";
    }
  }

  return (
    <button
      type="button"
      className={`market-sort-header${active ? " market-sort-header--active" : ""}`}
      onClick={() => onSort(column)}
      aria-label={
        active
          ? `${sortLabel}, ${sortDirection === "asc" ? "ascending" : "descending"}`
          : sortLabel
      }
    >
      <span>{displayLabel}</span>
      {active ? (
        <span className="market-sort-indicator" aria-hidden>
          {sortIndicator(sortDirection)}
        </span>
      ) : null}
    </button>
  );
}

export function MarketDataPage() {
  const { t } = useTranslation(["market", "common"]);
  const locale = useAppLocale();
  const [archive, setArchive] = useState<MonthlyArchive | null>(null);
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<MarketItemRow | null>(null);
  const [sortKey, setSortKey] = useState<MarketSortKey>(DEFAULT_MARKET_SORT.key);
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    DEFAULT_MARKET_SORT.direction,
  );
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

  const resolvedPricesByItemId = useMemo(() => {
    if (!archive) return new Map<number, ResolvedItemPrices>();
    return buildResolvedPricesMap(archive.snapshots);
  }, [archive]);

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

  const sortedItems = useMemo(
    () =>
      sortMarketItems(filteredItems, resolvedPricesByItemId, sortKey, sortDirection, locale),
    [filteredItems, locale, resolvedPricesByItemId, sortDirection, sortKey],
  );

  const handleSort = useCallback((column: TableColumn) => {
    const next = nextSortState(column, { key: sortKey, direction: sortDirection });
    setSortKey(next.key);
    setSortDirection(next.direction);
  }, [sortDirection, sortKey]);

  function sortLabelForKey(key: MarketSortKey): string {
    return t(`market:sort.${key}`);
  }

  function renderCell(
    item: MarketItemRow,
    column: TableColumn,
    resolved: ResolvedItemPrices | undefined,
  ): ReactNode {
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
            price={resolved?.bid ?? null}
            change={resolved?.bidDelta ?? null}
            locale={locale}
          />
        );
      case "ask":
        return (
          <PriceWithDelta
            price={resolved?.ask ?? null}
            change={resolved?.askDelta ?? null}
            locale={locale}
          />
        );
      case "prevClose":
        return (
          <span className="market-price-line market-change--flat">
            <span className="market-price-value">
              {formatPrice(resolved?.prevClose ?? null, locale)}
            </span>
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
                      aria-sort={
                        isSortKeyInColumn(column, sortKey)
                          ? sortDirection === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      <SortableHeader
                        column={column}
                        label={t(`market:columns.${column}`)}
                        sortKey={sortKey}
                        sortLabel={sortLabelForKey(
                          isSortKeyInColumn(column, sortKey)
                            ? sortKey
                            : COLUMN_SORT_SEQUENCE[column][0],
                        )}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item) => {
                  const itemName = translateNameId(item.name_id);
                  const resolved = resolvedPricesByItemId.get(item.itemId);
                  const hasPriceData = resolved?.hasAnyValidPrice ?? false;

                  return (
                    <tr
                      key={item.itemId}
                      className={[
                        "market-row-clickable",
                        hasPriceData ? "" : "market-row--no-price",
                      ]
                        .filter(Boolean)
                        .join(" ")}
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
                          {renderCell(item, column, resolved)}
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
