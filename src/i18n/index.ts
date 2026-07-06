import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import {
  DEFAULT_LOCALE,
  getStoredLocale,
  saveLocale,
  type AppLocale,
} from "../lib/locale-storage.ts";

import enCommon from "../locales/en/common.json";
import enHome from "../locales/en/home.json";
import enMarket from "../locales/en/market.json";
import enRecipes from "../locales/en/recipes.json";
import enProfit from "../locales/en/profit.json";
import enPlayer from "../locales/en/player.json";
import enGear from "../locales/en/gear.json";
import enGameNames from "../locales/en/game-names.json";

import ptCommon from "../locales/pt-BR/common.json";
import ptHome from "../locales/pt-BR/home.json";
import ptMarket from "../locales/pt-BR/market.json";
import ptRecipes from "../locales/pt-BR/recipes.json";
import ptProfit from "../locales/pt-BR/profit.json";
import ptPlayer from "../locales/pt-BR/player.json";
import ptGear from "../locales/pt-BR/gear.json";
import ptGameNames from "../locales/pt-BR/game-names.json";

export const I18N_NAMESPACES = [
  "common",
  "home",
  "market",
  "recipes",
  "profit",
  "player",
  "gear",
  "game-names",
] as const;

export type I18nNamespace = (typeof I18N_NAMESPACES)[number];

const resources = {
  en: {
    common: enCommon,
    home: enHome,
    market: enMarket,
    recipes: enRecipes,
    profit: enProfit,
    player: enPlayer,
    gear: enGear,
    "game-names": enGameNames,
  },
  "pt-BR": {
    common: ptCommon,
    home: ptHome,
    market: ptMarket,
    recipes: ptRecipes,
    profit: ptProfit,
    player: ptPlayer,
    gear: ptGear,
    "game-names": ptGameNames,
  },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: getStoredLocale(),
  fallbackLng: DEFAULT_LOCALE,
  defaultNS: "common",
  ns: [...I18N_NAMESPACES],
  interpolation: {
    escapeValue: false,
  },
});

i18n.on("languageChanged", (locale: string) => {
  if (locale === "en" || locale === "pt-BR") {
    saveLocale(locale as AppLocale);
  }
  document.documentElement.lang = locale;
});

document.documentElement.lang = i18n.language;

export default i18n;
