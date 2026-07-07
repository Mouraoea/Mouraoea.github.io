import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout.tsx";
import { HomePage } from "./pages/HomePage.tsx";
import { MarketDataPage } from "./pages/MarketDataPage.tsx";
import { PlayerSettingsPage } from "./pages/PlayerSettingsPage.tsx";
import { ProfitCalculatorPage } from "./pages/ProfitCalculatorPage.tsx";
import { RecipesPage } from "./pages/RecipesPage.tsx";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/idleclans/market" element={<MarketDataPage />} />
          <Route path="/idleclans/recipes" element={<RecipesPage />} />
          <Route path="/idleclans/profit" element={<ProfitCalculatorPage />} />
          <Route path="/idleclans/player" element={<PlayerSettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
