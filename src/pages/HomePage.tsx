import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./HomePage.css";

const TOOL_CARDS = [
  { to: "/idleclans/market", cardKey: "market" },
  { to: "/idleclans/recipes", cardKey: "recipes" },
  { to: "/idleclans/profit", cardKey: "profit" },
  { to: "/idleclans/player", cardKey: "player" },
] as const;

export function HomePage() {
  const { t } = useTranslation("home");

  return (
    <main className="page home-page">
      <header className="page-header home-hero">
        <h1>{t("title")}</h1>
        <p className="page-subtitle">{t("subtitle")}</p>
      </header>

      <div className="home-card-grid">
        {TOOL_CARDS.map(({ to, cardKey }) => (
          <Link key={to} to={to} className="home-card">
            <h2 className="home-card-title">{t(`cards.${cardKey}.title`)}</h2>
            <p className="home-card-desc">{t(`cards.${cardKey}.description`)}</p>
            <span className="home-card-arrow" aria-hidden>
              →
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
