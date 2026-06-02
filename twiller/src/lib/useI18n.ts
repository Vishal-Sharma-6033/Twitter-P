"use client";

import { useAuth } from "@/context/AuthContext";
import { getLanguageName, getLocaleForLanguage, translate, type LanguageCode } from "@/lib/i18n";

export const useI18n = () => {
  const { user } = useAuth();
  const language = (user?.preferredLanguage || "en") as LanguageCode;

  return {
    language,
    locale: getLocaleForLanguage(language),
    languageName: getLanguageName(language),
    t: (key: string, values?: Record<string, string | number>) =>
      translate(language, key, values),
  };
};
