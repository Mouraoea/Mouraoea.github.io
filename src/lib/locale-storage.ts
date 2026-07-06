export const SUPPORTED_LOCALES = ["en", "pt-BR"] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "en";

const STORAGE_KEY = "app-locale";

function isAppLocale(value: string): value is AppLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

function detectBrowserLocale(): AppLocale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  const language = navigator.language.toLowerCase();
  if (language.startsWith("pt")) return "pt-BR";
  return "en";
}

export function getStoredLocale(): AppLocale {
  if (typeof localStorage === "undefined") return detectBrowserLocale();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && isAppLocale(raw)) return raw;
  } catch {
    // ignore storage errors
  }

  return detectBrowserLocale();
}

export function saveLocale(locale: AppLocale): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // ignore storage errors
  }
}
