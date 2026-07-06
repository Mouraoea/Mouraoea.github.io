import type { TradePolicy } from "./market-prices.ts";
import i18n from "../i18n/index.ts";

export const TRADE_POLICY_VALUES: TradePolicy[] = [
  "highest_profit",
  "average_prices",
  "fast_trade",
];

export function translateTradePolicy(policy: TradePolicy): string {
  return i18n.t(`profit:tradePolicy.${policy}`);
}

export function buyPolicyPriceDescription(policy: TradePolicy): string {
  return i18n.t(`profit:buyPolicyDescription.${policy}`);
}

export function sellPolicyPriceDescription(policy: TradePolicy): string {
  return i18n.t(`profit:sellPolicyDescription.${policy}`);
}

export function pricingSummary(
  buyPolicy: TradePolicy,
  sellPolicy: TradePolicy,
): string {
  return i18n.t("profit:pricingSummary", {
    buy: buyPolicyPriceDescription(buyPolicy),
    sell: sellPolicyPriceDescription(sellPolicy),
  });
}
