import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ptBR from "./pt-BR.json";
import en from "./en.json";

const STORAGE_KEY = "axis-language";
const savedLang = localStorage.getItem(STORAGE_KEY) || "pt-BR";

i18n.use(initReactI18next).init({
  resources: {
    "pt-BR": { translation: ptBR },
    en: { translation: en },
  },
  lng: savedLang,
  fallbackLng: "pt-BR",
  interpolation: {
    escapeValue: false,
  },
});

i18n.on("languageChanged", (lng) => {
  localStorage.setItem(STORAGE_KEY, lng);
});

export default i18n;
