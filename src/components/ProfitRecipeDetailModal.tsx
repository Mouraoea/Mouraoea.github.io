import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { SkillBonuses } from "../bonuses/types.ts";
import { useAppLocale } from "./LanguageSwitcher.tsx";
import { translateNameId, translateSkillSlug } from "../i18n/game-labels.ts";
import {
  formatGold,
  formatIngredients,
  formatQuantitiesPerDay,
  formatQuantity,
  formatRatio,
  formatSecondaryOutput,
  formatTime,
  profitMoneyClass,
} from "../lib/profit-format.ts";
import type { RecipeRow } from "../recipes/profit-row.ts";
import { Modal } from "./Modal.tsx";
import "./ProfitRecipeDetailModal.css";

interface ProfitRecipeDetailModalProps {
  row: RecipeRow | null;
  bonuses?: SkillBonuses;
  onClose: () => void;
}

function DetailRow({
  label,
  value,
  valueClassName,
  title,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
  title?: string;
}) {
  return (
    <div className="detail-row">
      <dt className="detail-label">{label}</dt>
      <dd className={`detail-value ${valueClassName ?? ""}`.trim()} title={title}>
        {value}
      </dd>
    </div>
  );
}

export function ProfitRecipeDetailModal({
  row,
  bonuses,
  onClose,
}: ProfitRecipeDetailModalProps) {
  const { t } = useTranslation(["profit", "common"]);
  const locale = useAppLocale();
  const emDash = t("common:labels.emDash");

  if (!row) return null;

  const { skill, recipe, profit } = row;
  const recipeName = translateNameId(recipe.id);
  const skillName = translateSkillSlug(skill);

  const showEffectiveTime =
    !profit.isInstant &&
    bonuses &&
    profit.effectiveTimeSeconds !== recipe.baseTimeSeconds;

  const timeTitle = profit.isInstant
    ? t("profit:tooltips.profitPerDayInstant")
    : showEffectiveTime
      ? t("profit:tooltips.baseTime", { time: formatTime(recipe.baseTimeSeconds) })
      : undefined;

  const timeValue = profit.isInstant
    ? t("common:labels.instant")
    : showEffectiveTime
      ? formatTime(profit.effectiveTimeSeconds)
      : formatTime(recipe.baseTimeSeconds);

  const marketCapEntries = Object.entries(profit.marketCapacityRatios).filter(
    ([, ratio]) => ratio !== null,
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={recipeName}
      subtitle={skillName}
    >
      <dl className="detail-grid">
        <DetailRow
          label={t("profit:table.time")}
          value={
            <span className={profit.isInstant ? "profit-instant" : undefined}>
              {timeValue}
            </span>
          }
          title={timeTitle}
        />
        <DetailRow label={t("profit:table.output")} value={recipe.outputAmount} />
        <DetailRow
          label={t("profit:table.ingredients")}
          value={
            <span className="detail-value-wrap">
              {formatIngredients(recipe, emDash)}
            </span>
          }
        />
        <DetailRow
          label={t("profit:table.secondary")}
          value={formatSecondaryOutput(recipe) || emDash}
        />
        <DetailRow label={t("profit:table.level")} value={recipe.levelRequired} />
        <DetailRow
          label={t("profit:table.ingredientCost")}
          value={formatGold(profit.ingredientCost, locale, emDash)}
          valueClassName="profit-money"
        />
        <DetailRow
          label={t("profit:table.value")}
          value={formatGold(profit.productValue, locale, emDash)}
          valueClassName="profit-money"
        />
        <DetailRow
          label={t("profit:table.profit")}
          value={formatGold(profit.profit, locale, emDash)}
          valueClassName={profitMoneyClass(profit.profit)}
        />
        <DetailRow
          label={t("profit:table.profitPerDay")}
          value={formatGold(profit.profitPerDay, locale, emDash)}
          valueClassName={profitMoneyClass(profit.profitPerDay)}
        />
        <DetailRow
          label={t("profit:table.actionsPerDay")}
          value={formatQuantity(profit.actionsPerDay, locale)}
          valueClassName="profit-money"
        />
        <DetailRow
          label={t("profit:table.ingredientsPerDay")}
          value={
            <span className="detail-value-wrap">
              {formatQuantitiesPerDay(profit.ingredientsPerDay, locale, emDash)}
            </span>
          }
        />
        <DetailRow
          label={t("profit:table.outputPerDay")}
          value={
            <span className="detail-value-wrap">
              {formatQuantitiesPerDay(profit.outputsPerDay, locale, emDash)}
            </span>
          }
        />
        <DetailRow
          label={t("profit:table.maxMarketCapRatio")}
          value={
            <>
              <span>{formatRatio(profit.maxMarketCapacityRatio, locale)}</span>
              {marketCapEntries.length > 0 ? (
                <ul className="detail-breakdown" aria-label={t("profit:modal.marketCapBreakdown")}>
                  {marketCapEntries.map(([item, ratio]) => (
                    <li key={item}>
                      {translateNameId(item)}: {formatRatio(ratio, locale)}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          }
          valueClassName={profitMoneyClass(profit.maxMarketCapacityRatio)}
        />
      </dl>
    </Modal>
  );
}
