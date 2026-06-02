"use client";

import React from "react";
import { AuthProvider } from "@/context/AuthContext";
import LanguageDocumentSync from "./LanguageDocumentSync";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <LanguageDocumentSync />
      {children}
    </AuthProvider>
  );
}
