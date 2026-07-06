import { BrowserRouter, Route, Routes } from "react-router-dom";
import { LanguageSwitcher } from "./components/LanguageSwitcher.tsx";
import "./components/LanguageSwitcher.css";
import { HomePage } from "./pages/HomePage.tsx";
import { MarketDataPage } from "./pages/MarketDataPage.tsx";
import { PlayerSettingsPage } from "./pages/PlayerSettingsPage.tsx";
import { ProfitCalculatorPage } from "./pages/ProfitCalculatorPage.tsx";
import { RecipesPage } from "./pages/RecipesPage.tsx";

export function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <header className="app-layout-header">
          <LanguageSwitcher />
        </header>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/idleclans/market" element={<MarketDataPage />} />
          <Route path="/idleclans/recipes" element={<RecipesPage />} />
          <Route path="/idleclans/profit" element={<ProfitCalculatorPage />} />
          <Route path="/idleclans/player" element={<PlayerSettingsPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
