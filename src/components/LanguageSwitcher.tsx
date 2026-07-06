import { useTranslation } from "react-i18next";
import i18n from "../i18n/index.ts";
import { SUPPORTED_LOCALES, type AppLocale } from "../lib/locale-storage.ts";
import "./LanguageSwitcher.css";

export function LanguageSwitcher() {
  const { t } = useTranslation("common");

  return (
    <label className="language-switcher">
      <span className="language-switcher-label">{t("language")}</span>
      <select
        value={i18n.language}
        onChange={(e) => void i18n.changeLanguage(e.target.value)}
        aria-label={t("language")}
      >
        {SUPPORTED_LOCALES.map((locale) => (
          <option key={locale} value={locale}>
            {t(`locale.${locale}`)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function useAppLocale(): AppLocale {
  return i18n.language === "pt-BR" ? "pt-BR" : "en";
}
