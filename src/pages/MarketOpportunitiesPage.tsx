import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { MarketItemDetailModal } from "../components/MarketItemDetailModal.tsx";
import { useAppLocale } from "../components/LanguageSwitcher.tsx";
import type { MarketItemRow, MonthlyArchive } from "../fetcher/types.ts";
import { translateNameId } from "../i18n/game-labels.ts";
import {
  formatPercentChange,
  priceChangeDirection,
} from "../lib/market-price-change.ts";
import {
  buildTradingMetricsMap,
  opportunityScore,
  rankOpportunities,
  type ItemTradingMetrics,
  type OpportunityStrategy,
} from "../lib/market-metrics.ts";
import { formatCompactNumber } from "../lib/format-compact-number.ts";
import {
  currentMonthKey,
  loadMonthlyArchive,
} from "../lib/market-archive.ts";
import "./MarketOpportunitiesPage.css";

function formatPrice(value: number | null, locale: string): string {
  if (value === null || value <= 0) return "—";
  return formatCompactNumber(value, locale);
}

function formatPercent(value: number | null, locale: string): string {
  if (value === null) return "—";
  return formatPercentChange(value, locale);
}

export function MarketOpportunitiesPage() {
  const { t } = useTranslation(["opportunities", "market", "common"]);
  const locale = useAppLocale();
  const [archive, setArchive] = useState<MonthlyArchive | null>(null);
  const [strategy, setStrategy] = useState<OpportunityStrategy>("upside");
  const [liquidOnly, setLiquidOnly] = useState(true);
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

  const metricsByItemId = useMemo(() => {
    if (!archive || !latestSnapshot) return new Map<number, ItemTradingMetrics>();
    return buildTradingMetricsMap(archive.snapshots, latestSnapshot);
  }, [archive, latestSnapshot]);

  const rankedItems = useMemo(() => {
    if (!latestSnapshot) return [];
    const visible = latestSnapshot.items.filter((item) => item.itemId !== -1);
    return rankOpportunities(visible, metricsByItemId, strategy, liquidOnly);
  }, [latestSnapshot, liquidOnly, metricsByItemId, strategy]);

  return (
    <main className="page">
      <header className="page-header">
        <h1>{t("opportunities:title")}</h1>
        <p className="page-subtitle">{t("opportunities:subtitle")}</p>
      </header>

      <section className="control-bar">
        <label className="field">
          {t("opportunities:strategy")}
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as OpportunityStrategy)}
          >
            <option value="upside">{t("opportunities:strategies.upside")}</option>
            <option value="spread">{t("opportunities:strategies.spread")}</option>
          </select>
        </label>

        <label className="field field-checkbox">
          <input
            type="checkbox"
            checked={liquidOnly}
            onChange={(e) => setLiquidOnly(e.target.checked)}
          />
          {t("market:filters.liquidOnly")}
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
        <div className="table-wrap opportunities-table-wrap">
          {rankedItems.length === 0 ? (
            <p className="status-text">{t("opportunities:empty")}</p>
          ) : (
            <table className="data-table opportunities-table">
              <thead>
                <tr>
                  <th>{t("market:columns.item")}</th>
                  <th>{t("opportunities:columns.score")}</th>
                  <th>{t("market:columns.vs7d")}</th>
                  <th>{t("market:columns.spreadPercent")}</th>
                  <th>{t("market:columns.volume24h")}</th>
                  <th>{t("market:columns.bid")}</th>
                  <th>{t("market:columns.ask")}</th>
                </tr>
              </thead>
              <tbody>
                {rankedItems.map((item) => {
                  const metrics = metricsByItemId.get(item.itemId);
                  const score = metrics
                    ? opportunityScore(metrics, strategy)
                    : null;
                  const deltaDirection = priceChangeDirection(metrics?.bidDelta ?? null);

                  return (
                    <tr
                      key={item.itemId}
                      className="opportunities-row-clickable"
                      tabIndex={0}
                      role="button"
                      onClick={() => setSelectedItem(item)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedItem(item);
                        }
                      }}
                    >
                      <td>
                        <div className="market-cell-item">
                          <span className="market-cell-name">
                            {translateNameId(item.name_id)}
                          </span>
                          <span className="market-cell-meta">{item.name_id}</span>
                        </div>
                      </td>
                      <td>{score !== null ? score.toFixed(2) : "—"}</td>
                      <td className={`market-change--${deltaDirection === "flat" ? "flat" : deltaDirection}`}>
                        {formatPercent(metrics?.vs7d ?? null, locale)}
                      </td>
                      <td>{formatPercent(metrics?.spreadPercent ?? null, locale)}</td>
                      <td>{formatPrice(metrics?.volume24h ?? null, locale)}</td>
                      <td>{formatPrice(metrics?.bid ?? null, locale)}</td>
                      <td>{formatPrice(metrics?.ask ?? null, locale)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      <MarketItemDetailModal
        item={selectedItem}
        archive={archive}
        onClose={() => setSelectedItem(null)}
      />
    </main>
  );
}
