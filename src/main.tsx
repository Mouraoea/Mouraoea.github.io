import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { App } from "./App.tsx";
import i18n from "./i18n/index.ts";
import "./index.css";
import "./styles/components.css";

function AppWithTitle() {
  useEffect(() => {
    const setTitle = () => {
      document.title = i18n.t("common:appTitle");
    };
    setTitle();
    i18n.on("languageChanged", setTitle);
    return () => {
      i18n.off("languageChanged", setTitle);
    };
  }, []);

  return <App />;
}

const root = document.getElementById("root");

if (root) {
  createRoot(root).render(
    <StrictMode>
      <I18nextProvider i18n={i18n}>
        <AppWithTitle />
      </I18nextProvider>
    </StrictMode>,
  );
}
