import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useAppLocale } from "./LanguageSwitcher.tsx";
import { translateNameId } from "../i18n/game-labels.ts";
import type { MarketItemRow, MonthlyArchive } from "../fetcher/types.ts";
import { formatCompactNumber } from "../lib/format-compact-number.ts";
import { computeSpread } from "../lib/market-item-history.ts";
import {
  buildSanitizedItemHistory,
  resolveLatestPrices,
  toChartHistoryPoints,
} from "../lib/market-price-sanitize.ts";
import { Modal } from "./Modal.tsx";
import { MarketPriceChart } from "./MarketPriceChart.tsx";
import "./MarketItemDetailModal.css";

interface MarketItemDetailModalProps {
  item: MarketItemRow | null;
  archive: MonthlyArchive | null;
  onClose: () => void;
}

function formatNullableNumber(
  value: number | null,
  locale: string,
): string {
  if (value === null || value === undefined || value <= 0) return "—";
  return formatCompactNumber(value, locale);
}

export function MarketItemDetailModal({
  item,
  archive,
  onClose,
}: MarketItemDetailModalProps) {
  const { t } = useTranslation(["market", "common"]);
  const locale = useAppLocale();

  const { history, resolved } = useMemo(() => {
    if (!item || !archive) {
      return { history: [], resolved: null };
    }

    const sanitized = buildSanitizedItemHistory(archive.snapshots, item.itemId);
    return {
      history: toChartHistoryPoints(sanitized),
      resolved: resolveLatestPrices(sanitized),
    };
  }, [archive, item]);

  if (!item) return null;

  const spread = computeSpread(resolved?.bid ?? null, resolved?.ask ?? null);

  return (
    <Modal
      open
      onClose={onClose}
      title={translateNameId(item.name_id)}
      panelClassName="modal-panel--wide"
    >
      {!resolved?.hasAnyValidPrice ? (
        <p className="market-modal-empty-chart">{t("market:noPriceData")}</p>
      ) : (
        <div className="market-modal-stats">
          <div className="market-modal-stat">
            <span className="market-modal-stat-label">{t("market:modal.bid")}</span>
            <span className="market-modal-stat-value">
              {formatNullableNumber(resolved.bid, locale)}
            </span>
          </div>
          <div className="market-modal-stat">
            <span className="market-modal-stat-label">{t("market:modal.ask")}</span>
            <span className="market-modal-stat-value">
              {formatNullableNumber(resolved.ask, locale)}
            </span>
          </div>
          <div className="market-modal-stat">
            <span className="market-modal-stat-label">{t("market:modal.prevClose")}</span>
            <span className="market-modal-stat-value">
              {formatNullableNumber(resolved.prevClose, locale)}
            </span>
          </div>
          <div className="market-modal-stat">
            <span className="market-modal-stat-label">{t("market:modal.spread")}</span>
            <span className="market-modal-stat-value">
              {formatNullableNumber(spread, locale)}
            </span>
          </div>
          <div className="market-modal-stat">
            <span className="market-modal-stat-label">{t("market:modal.volume24h")}</span>
            <span className="market-modal-stat-value">
              {formatNullableNumber(item.tradeVolume1Day, locale)}
            </span>
          </div>
        </div>
      )}

      <section className="market-modal-chart-section" aria-label={t("market:modal.chartTitle")}>
        <h3 className="market-modal-section-title">{t("market:modal.priceHistory")}</h3>
        {history.length >= 2 ? (
          <MarketPriceChart
            points={history}
            locale={locale}
            labels={{
              bid: t("market:modal.bid"),
              ask: t("market:modal.ask"),
              prevClose: t("market:modal.prevClose"),
            }}
          />
        ) : (
          <p className="market-modal-empty-chart">{t("market:modal.noHistory")}</p>
        )}
      </section>

      {resolved?.hasAnyValidPrice ? (
        <section aria-label={t("market:modal.periodAverages")}>
          <h3 className="market-modal-section-title">{t("market:modal.periodAverages")}</h3>
          <div className="market-modal-averages">
            <div className="market-modal-average">
              <span className="market-modal-average-label">{t("market:modal.avg7d")}</span>
              <span className="market-modal-average-value">
                {formatNullableNumber(item.history_7d, locale)}
              </span>
            </div>
            <div className="market-modal-average">
              <span className="market-modal-average-label">{t("market:modal.avg30d")}</span>
              <span className="market-modal-average-value">
                {formatNullableNumber(item.history_30d, locale)}
              </span>
            </div>
            <div className="market-modal-average">
              <span className="market-modal-average-label">{t("market:modal.avg1y")}</span>
              <span className="market-modal-average-value">
                {formatNullableNumber(item.history_1y, locale)}
              </span>
            </div>
          </div>
        </section>
      ) : null}
    </Modal>
  );
}
