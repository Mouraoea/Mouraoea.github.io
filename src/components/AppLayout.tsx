import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher.tsx";
import "./AppLayout.css";

const NAV_ITEMS = [
  { to: "/", labelKey: "home", end: true },
  { to: "/idleclans/market", labelKey: "marketData", end: false },
  { to: "/idleclans/opportunities", labelKey: "opportunities", end: false },
  { to: "/idleclans/recipes", labelKey: "recipes", end: false },
  { to: "/idleclans/profit", labelKey: "profitCalculator", end: false },
  { to: "/idleclans/player", labelKey: "playerGear", end: false },
] as const;

export function AppLayout() {
  const { t } = useTranslation("common");
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <Link to="/" className="app-brand" onClick={closeMenu}>
            {t("appTitle")}
          </Link>

          <button
            type="button"
            className="app-menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="app-nav"
            aria-label={menuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="app-menu-icon" aria-hidden />
          </button>

          <nav
            id="app-nav"
            className={["app-nav", menuOpen ? "open" : ""].filter(Boolean).join(" ")}
          >
            <ul className="app-nav-list">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      ["app-nav-link", isActive ? "active" : ""]
                        .filter(Boolean)
                        .join(" ")
                    }
                    onClick={closeMenu}
                  >
                    {item.labelKey === "home"
                      ? t("nav.home")
                      : t(`nav.${item.labelKey}`)}
                  </NavLink>
                </li>
              ))}
            </ul>
            <div className="app-nav-lang">
              <LanguageSwitcher />
            </div>
          </nav>

          <div className="app-header-lang">
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
