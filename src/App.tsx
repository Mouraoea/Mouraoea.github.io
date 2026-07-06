import { BrowserRouter, Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage.tsx";
import { MarketDataPage } from "./pages/MarketDataPage.tsx";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/idleclans/market" element={<MarketDataPage />} />
      </Routes>
    </BrowserRouter>
  );
}
