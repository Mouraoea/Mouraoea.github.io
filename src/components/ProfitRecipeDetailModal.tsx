import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { useAppLocale } from "./LanguageSwitcher.tsx";
import { translateNameId, translateSkillSlug } from "../i18n/game-labels.ts";
import {
  formatEffectiveIngredients,
  formatEffectiveQuantity,
  formatEffectiveSecondaryOutput,
  formatGold,
  formatQuantitiesPerDay,
  formatQuantity,
  formatRatio,
  formatTime,
  profitMoneyClass,
} from "../lib/profit-format.ts";
import type { QuantityPerDay } from "../recipes/profit.ts";
import type { RecipeRow } from "../recipes/profit-row.ts";
import { Modal } from "./Modal.tsx";
import "./ProfitRecipeDetailModal.css";

interface ProfitRecipeDetailModalProps {
  row: RecipeRow | null;
  onClose: () => void;
}

function DetailRow({
  label,
  value,
  valueClassName,
  title,
}: {
  label: ReactNode;
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

function MarketCapItemRows({
  items,
  marketCapacityRatios,
  locale,
  perDayLabel,
}: {
  items: QuantityPerDay[];
  marketCapacityRatios: Record<string, number | null>;
  locale: string;
  perDayLabel: (quantity: string) => string;
}) {
  return items.map(({ item, quantityPerDay }) => {
    const ratio = marketCapacityRatios[item] ?? null;
    const quantityLabel = formatQuantity(quantityPerDay, locale);

    return (
      <DetailRow
        key={item}
        label={
          <>
            {translateNameId(item)}
            <span className="detail-item-meta">
              {perDayLabel(quantityLabel)}
            </span>
          </>
        }
        value={formatRatio(ratio, locale)}
        valueClassName={profitMoneyClass(ratio)}
      />
    );
  });
}

export function ProfitRecipeDetailModal({
  row,
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
    !profit.isInstant && profit.effectiveTimeSeconds !== recipe.baseTimeSeconds;

  const showEffectiveOutput =
    profit.effectiveOutputAmount !== recipe.outputAmount;

  const showEffectiveIngredients = recipe.ingredients.some((ingredient) => {
    const effective = profit.effectiveIngredients.find(
      (entry) => entry.item === ingredient.item,
    );
    return effective ? effective.quantity !== ingredient.quantity : false;
  });

  const showEffectiveSecondary =
    recipe.secondaryOutput !== null &&
    profit.effectiveSecondaryOutput !== null &&
    profit.effectiveSecondaryOutput.quantity !== recipe.secondaryOutput.quantity;

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

  const perDayLabel = (quantity: string) =>
    t("profit:modal.marketCapPerDay", { quantity });

  const hasMarketCapItems =
    profit.ingredientsPerDay.length > 0 || profit.outputsPerDay.length > 0;

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
        <DetailRow
          label={t("profit:table.output")}
          value={formatEffectiveQuantity(profit.effectiveOutputAmount)}
          title={
            showEffectiveOutput
              ? t("profit:tooltips.baseOutput", {
                  output: formatEffectiveQuantity(recipe.outputAmount),
                })
              : undefined
          }
          valueClassName={showEffectiveOutput ? "profit-positive" : undefined}
        />
        <DetailRow
          label={t("profit:table.ingredients")}
          value={
            <span className="detail-value-wrap">
              {formatEffectiveIngredients(profit.effectiveIngredients, emDash)}
            </span>
          }
          title={
            showEffectiveIngredients
              ? t("profit:tooltips.baseIngredients", {
                  ingredients: formatEffectiveIngredients(
                    recipe.ingredients.map((ingredient) => ({
                      item: ingredient.item,
                      quantity: ingredient.quantity,
                    })),
                    emDash,
                  ),
                })
              : undefined
          }
          valueClassName={showEffectiveIngredients ? "profit-positive" : undefined}
        />
        <DetailRow
          label={t("profit:table.secondary")}
          value={
            profit.effectiveSecondaryOutput
              ? formatEffectiveSecondaryOutput(profit.effectiveSecondaryOutput)
              : emDash
          }
          title={
            showEffectiveSecondary && recipe.secondaryOutput
              ? t("profit:tooltips.baseSecondary", {
                  secondary: formatEffectiveSecondaryOutput(recipe.secondaryOutput),
                })
              : undefined
          }
          valueClassName={showEffectiveSecondary ? "profit-positive" : undefined}
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
      </dl>

      {hasMarketCapItems ? (
        <section className="detail-section" aria-labelledby="profit-market-cap-title">
          <h3 id="profit-market-cap-title" className="detail-section-title">
            {t("profit:modal.marketCapTitle")}
          </h3>
          <dl className="detail-grid">
            {profit.ingredientsPerDay.length > 0 ? (
              <>
                <p className="detail-subsection-title">
                  {t("profit:modal.marketCapIngredients")}
                </p>
                <MarketCapItemRows
                  items={profit.ingredientsPerDay}
                  marketCapacityRatios={profit.marketCapacityRatios}
                  locale={locale}
                  perDayLabel={perDayLabel}
                />
              </>
            ) : null}
            {profit.outputsPerDay.length > 0 ? (
              <>
                <p className="detail-subsection-title">
                  {t("profit:modal.marketCapProducts")}
                </p>
                <MarketCapItemRows
                  items={profit.outputsPerDay}
                  marketCapacityRatios={profit.marketCapacityRatios}
                  locale={locale}
                  perDayLabel={perDayLabel}
                />
              </>
            ) : null}
          </dl>
        </section>
      ) : null}
    </Modal>
  );
}
