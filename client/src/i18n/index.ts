import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ptBR from "./pt-BR.json";
import en from "./en.json";

const STORAGE_KEY = "axis-language";
const SUPPORTED_LANGUAGES = ["pt-BR", "en"] as const;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

function normalizeLang(lang: string): SupportedLanguage {
  if (lang === "pt-BR" || lang.startsWith("pt")) return "pt-BR";
  if (lang === "en" || lang.startsWith("en")) return "en";
  return "pt-BR";
}

const rawSaved = localStorage.getItem(STORAGE_KEY) ?? "";
const savedLang: SupportedLanguage = SUPPORTED_LANGUAGES.includes(rawSaved as SupportedLanguage)
  ? (rawSaved as SupportedLanguage)
  : normalizeLang(rawSaved || "pt-BR");

i18n.use(initReactI18next).init({
  resources: {
    "pt-BR": { translation: ptBR, axisAdmin: ptBR.axisAdmin },
    en: { translation: en, axisAdmin: en.axisAdmin },
  },
  lng: savedLang,
  fallbackLng: "pt-BR",
  interpolation: {
    escapeValue: false,
  },
});

i18n.on("languageChanged", (lng) => {
  const normalized = normalizeLang(lng);
  localStorage.setItem(STORAGE_KEY, normalized);
});

export default i18n;
