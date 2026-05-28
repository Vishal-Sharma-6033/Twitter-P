"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, KeyRound, Mail, Phone, RefreshCw, ShieldAlert } from "lucide-react";
import { sendPasswordResetEmail } from "firebase/auth";
import axios from "axios";

import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Separator } from "./ui/separator";
import TwitterLogo from "./Twitterlogo";
import { auth } from "@/context/firebase";
import axiosInstance from "@/lib/axiosInstance";
import {
  generateLetterOnlyPassword,
  normalizePasswordResetIdentifier,
  normalizePhoneInput,
} from "@/lib/password-reset";

type IdentifierType = "email" | "phone";

const maskEmail = (value: string) => {
  const [localPart = "", domainPart = ""] = value.split("@");

  if (!localPart || !domainPart) {
    return value;
  }

  const visiblePrefix = localPart.slice(0, 2);
  return `${visiblePrefix}${"*".repeat(Math.max(2, localPart.length - 2))}@${domainPart}`;
};

const getAuthErrorMessage = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error || error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to reset password right now.";
};

export default function ForgotPasswordPage() {
  const [identifierType, setIdentifierType] = useState<IdentifierType>("email");
  const [identifier, setIdentifier] = useState("");
  const [generatedPassword, setGeneratedPassword] = useState(() => generateLetterOnlyPassword());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const normalizedIdentifier = useMemo(() => {
    if (identifierType === "phone") {
      return normalizePhoneInput(identifier);
    }

    return normalizePasswordResetIdentifier(identifier).toLowerCase();
  }, [identifier, identifierType]);

  const handleGeneratePassword = async () => {
    setIsGenerating(true);
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    setGeneratedPassword(generateLetterOnlyPassword());
    setCopied(false);
    setIsGenerating(false);
  };

  const handleCopyPassword = async () => {
    await navigator.clipboard.writeText(generatedPassword);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!normalizedIdentifier) {
      setError(identifierType === "email" ? "Email address is required." : "Phone number is required.");
      return;
    }

    if (!auth) {
      setError("Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* values to .env.local.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await axiosInstance.post("/forgot-password/request", {
        identifier: normalizedIdentifier,
        identifierType,
      });

      const resetEmail = response.data.email as string;
      await sendPasswordResetEmail(auth, resetEmail);

      setMessage(
        `Reset instructions were sent to ${maskEmail(resetEmail)}. You can use the generated password below when you set a new one.`
      );
    } catch (error) {
      setError(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleIdentifierTypeChange = (nextType: IdentifierType) => {
    setIdentifierType(nextType);
    setError("");
    setMessage("");

    if (nextType === "phone") {
      setIdentifier((currentValue) => normalizePhoneInput(currentValue));
      return;
    }

    setIdentifier((currentValue) => currentValue.trim());
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.2),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.18),_transparent_30%),linear-gradient(135deg,_#050816_0%,_#0b1220_45%,_#111827_100%)] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 lg:px-8">
        <div className="flex items-center justify-between pb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-300 transition hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
          <TwitterLogo size="md" className="text-white" />
        </div>

        <div className="grid flex-1 items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
              <ShieldAlert className="h-4 w-4" />
              Account recovery with a daily limit
            </div>

            <div className="space-y-4">
              <h1 className="max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                Restore access without making recovery feel like a maze.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                Use your registered email address or phone number to request a reset.
                The platform allows one recovery request per day and sends the reset
                instructions to the linked email account.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="border-white/10 bg-white/5 text-white shadow-2xl shadow-cyan-950/30 backdrop-blur">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 text-cyan-200">
                    <Mail className="h-5 w-5" />
                    <span className="font-medium">Email or phone lookup</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    Choose the identifier you registered with. We resolve it to the
                    account email before sending the reset mail.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-white/10 bg-white/5 text-white shadow-2xl shadow-emerald-950/30 backdrop-blur">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 text-emerald-200">
                    <KeyRound className="h-5 w-5" />
                    <span className="font-medium">Letter-only generator</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    Create a simple password with uppercase and lowercase letters only.
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>

          <div className="relative">
            <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-cyan-500/20 via-transparent to-emerald-500/20 blur-2xl" />
            <Card className="relative border-white/10 bg-slate-950/85 text-white shadow-2xl shadow-black/40 backdrop-blur-xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl">Forgot password</CardTitle>
                <CardDescription className="text-slate-300">
                  Request a recovery email and generate a fresh password for your next login.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {error && (
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                    {error}
                  </div>
                )}

                {message && (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                    {message}
                  </div>
                )}

                <form className="space-y-5" onSubmit={handleSubmit}>
                  <div className="space-y-3">
                    <Label className="text-slate-200">Recover with</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        type="button"
                        variant={identifierType === "email" ? "default" : "outline"}
                        className={identifierType === "email" ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400" : "border-white/15 bg-transparent text-white hover:bg-white/10"}
                        onClick={() => handleIdentifierTypeChange("email")}
                      >
                        <Mail className="mr-2 h-4 w-4" />
                        Email
                      </Button>
                      <Button
                        type="button"
                        variant={identifierType === "phone" ? "default" : "outline"}
                        className={identifierType === "phone" ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400" : "border-white/15 bg-transparent text-white hover:bg-white/10"}
                        onClick={() => handleIdentifierTypeChange("phone")}
                      >
                        <Phone className="mr-2 h-4 w-4" />
                        Phone
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="identifier" className="text-slate-200">
                      {identifierType === "email" ? "Registered email address" : "Registered phone number"}
                    </Label>
                    <Input
                      id="identifier"
                      type={identifierType === "email" ? "email" : "tel"}
                      inputMode={identifierType === "email" ? "email" : "tel"}
                      placeholder={identifierType === "email" ? "name@example.com" : "+1 555 010 0123"}
                      value={identifier}
                      onChange={(event) => setIdentifier(event.target.value)}
                      className="h-11 border-white/10 bg-white/5 text-white placeholder:text-slate-400 focus-visible:border-cyan-400/50 focus-visible:ring-cyan-400/20"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="h-11 w-full rounded-full bg-white text-slate-950 hover:bg-cyan-200"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <span className="inline-flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Sending reset link...
                      </span>
                    ) : (
                      "Send reset instructions"
                    )}
                  </Button>
                </form>

                <Separator className="bg-white/10" />

                <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center gap-2 text-emerald-200">
                    <KeyRound className="h-5 w-5" />
                    <h2 className="font-medium">Password generator</h2>
                  </div>
                  <p className="text-sm leading-6 text-slate-300">
                    Generate a simple password made only of uppercase and lowercase letters.
                    No numbers or symbols are included.
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Input
                      readOnly
                      value={generatedPassword}
                      className="h-11 border-white/10 bg-slate-950/60 text-white"
                    />
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 flex-1 border-white/15 bg-transparent text-white hover:bg-white/10"
                        onClick={handleGeneratePassword}
                        disabled={isGenerating}
                      >
                        <RefreshCw className={`mr-2 h-4 w-4 ${isGenerating ? "animate-spin" : ""}`} />
                        Generate
                      </Button>
                      <Button
                        type="button"
                        className="h-11 flex-1 bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                        onClick={handleCopyPassword}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        {copied ? "Copied" : "Copy"}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}