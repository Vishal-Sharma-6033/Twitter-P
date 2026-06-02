"use client";

import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { CheckCircle2, Languages, Mail, Smartphone, ShieldCheck } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import axiosInstance from "@/lib/axiosInstance";
import { LANGUAGE_OPTIONS, type LanguageCode } from "@/lib/i18n";
import { useI18n } from "@/lib/useI18n";

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const { language, languageName, t } = useI18n();
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>(language);
  const [otp, setOtp] = useState("");
  const [isRequesting, setIsRequesting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [deliveryChannel, setDeliveryChannel] = useState<"email" | "mobile" | "">("");
  const [devOtp, setDevOtp] = useState("");

  useEffect(() => {
    setSelectedLanguage(language);
  }, [language]);

  const selectedLanguageOption = useMemo(
    () => LANGUAGE_OPTIONS.find((option) => option.code === selectedLanguage),
    [selectedLanguage]
  );

  const requestOtp = async () => {
    if (!user?.email) {
      setError("Please sign in to change your language.");
      return;
    }

    setError("");
    setMessage("");
    setIsRequesting(true);

    try {
      const response = await axiosInstance.post("/language-otp/request", {
        email: user.email,
        language: selectedLanguage,
      });

      setDeliveryChannel(response.data.delivery);
      setDevOtp(response.data.devOtp || "");
      setMessage(response.data.message || t("OTP sent successfully."));
    } catch (requestError) {
      setError(
        axios.isAxiosError(requestError)
          ? requestError.response?.data?.error || requestError.message
          : requestError instanceof Error
            ? requestError.message
            : "Unable to request an OTP right now."
      );
    } finally {
      setIsRequesting(false);
    }
  };

  const verifyOtp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user?.email) {
      setError("Please sign in to change your language.");
      return;
    }

    if (!otp.trim()) {
      setError("Enter the OTP before continuing.");
      return;
    }

    setError("");
    setMessage("");
    setIsVerifying(true);

    try {
      await axiosInstance.post("/language-otp/verify", {
        email: user.email,
        language: selectedLanguage,
        otp: otp.trim(),
      });

      await refreshUser();
      setMessage(t("Language updated successfully."));
      setOtp("");
      setDevOtp("");
    } catch (verifyError) {
      setError(
        axios.isAxiosError(verifyError)
          ? verifyError.response?.data?.error || verifyError.message
          : verifyError instanceof Error
            ? verifyError.message
            : "Unable to verify the OTP right now."
      );
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(34,197,94,0.18),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-sm text-cyan-200">
                <Languages className="h-4 w-4" />
                {t("Language settings")}
              </div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {t("Choose your preferred language and verify the switch securely.")}
              </h1>
              <p className="text-sm leading-6 text-slate-300 sm:text-base">
                {t("French changes are verified by email. All other languages use the registered mobile number.")}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("Current language")}</div>
              <div className="mt-1 text-lg font-semibold text-white">{languageName}</div>
              <div className="mt-1 text-xs text-slate-400">{user?.email || ""}</div>
            </div>
          </div>
        </section>

        {(message || error) && (
          <div className="space-y-3">
            {message && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-100">
                {message}
              </div>
            )}
            {error && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-100">
                {error}
              </div>
            )}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/70 p-6">
            <div className="flex items-center gap-2 text-slate-200">
              <ShieldCheck className="h-5 w-5 text-cyan-300" />
              <h2 className="text-lg font-semibold">{t("Switch language")}</h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {LANGUAGE_OPTIONS.map((option) => {
                const isSelected = option.code === selectedLanguage;

                return (
                  <button
                    key={option.code}
                    type="button"
                    onClick={() => setSelectedLanguage(option.code)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      isSelected
                        ? "border-cyan-400/60 bg-cyan-400/10"
                        : "border-white/10 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-white">{option.label}</div>
                        <div className="text-sm text-slate-400">{option.nativeLabel}</div>
                      </div>
                      {isSelected && <CheckCircle2 className="h-5 w-5 text-cyan-300" />}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300">
              <div className="font-medium text-white">{t("Selected language")}</div>
              <div className="mt-1">{selectedLanguageOption?.label || languageName}</div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1">
                  <Mail className="h-3.5 w-3.5" />
                  {t("Email")}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1">
                  <Smartphone className="h-3.5 w-3.5" />
                  {t("Mobile")}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={requestOtp}
              disabled={isRequesting}
              className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isRequesting ? "Requesting..." : t("Request OTP")}
            </button>
          </div>

          <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-white">{t("Verify OTP")}</h2>
              <p className="text-sm leading-6 text-slate-300">
                {selectedLanguage === "fr"
                  ? "Check the email address linked to your account for the verification code."
                  : "Check the mobile number linked to your account for the verification code."}
              </p>
            </div>

            <form className="space-y-4" onSubmit={verifyOtp}>
              <div className="space-y-2">
                <label className="text-sm text-slate-300">OTP</label>
                <input
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                  placeholder="123456"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isVerifying}
                className="inline-flex w-full items-center justify-center rounded-full bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isVerifying ? "Verifying..." : t("Verify OTP")}
              </button>
            </form>

            {devOtp && (
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
                Development OTP: {devOtp}
              </div>
            )}

            {deliveryChannel && (
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300">
                {t("Selected language")} {selectedLanguageOption?.label || languageName} · {t("Send OTP to")} {deliveryChannel === "email" ? t("Email") : t("Mobile")}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
