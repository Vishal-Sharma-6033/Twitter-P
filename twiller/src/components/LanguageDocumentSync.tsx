"use client";

import { useEffect } from "react";
import { useI18n } from "@/lib/useI18n";

export default function LanguageDocumentSync() {
  const { language } = useI18n();

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return null;
}
