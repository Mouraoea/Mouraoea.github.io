import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function HomePage() {
  const { t } = useTranslation(["home", "common"]);

  return (
    <main className="home-page">
      <h1>{t("home:title")}</h1>
      <p>{t("home:subtitle")}</p>
      <nav>
        <Link to="/idleclans/market">{t("common:nav.marketData")}</Link>
        {" · "}
        <Link to="/idleclans/recipes">{t("common:nav.recipes")}</Link>
        {" · "}
        <Link to="/idleclans/profit">{t("common:nav.profitCalculator")}</Link>
        {" · "}
        <Link to="/idleclans/player">{t("common:nav.playerGear")}</Link>
      </nav>
    </main>
  );
}
