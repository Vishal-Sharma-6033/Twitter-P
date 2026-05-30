"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileText, Home } from "lucide-react";

import axiosInstance from "@/lib/axiosInstance";
import { getPlanById } from "@/lib/subscription";

import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import LoadingSpinner from "./loading-spinner";

export default function SubscriptionSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<{
    planId: string;
    invoiceNumber: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    const confirmPayment = async () => {
      if (!sessionId) {
        setError("Missing payment session.");
        setLoading(false);
        return;
      }

      try {
        const response = await axiosInstance.post("/subscription/confirm", {
          sessionId,
        });

        setSummary({
          planId: response.data?.user?.subscriptionPlan || "free",
          invoiceNumber: response.data?.payment?.invoiceNumber || sessionId,
          message: response.data?.message || "Subscription activated successfully.",
        });
      } catch (confirmError) {
        const message =
          confirmError instanceof Error
            ? confirmError.message
            : "Unable to confirm payment.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void confirmPayment();
  }, [sessionId]);

  useEffect(() => {
    if (!summary || error) {
      return;
    }

    const redirectTimer = window.setTimeout(() => {
      router.replace("/");
    }, 2500);

    return () => window.clearTimeout(redirectTimer);
  }, [summary, error, router]);

  const activePlan = summary ? getPlanById(summary.planId) : null;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.22),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.18),_transparent_30%),linear-gradient(180deg,_#020617_0%,_#111827_100%)] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <Card className="w-full border-white/10 bg-slate-950/80 text-white shadow-2xl backdrop-blur-xl">
          <CardHeader className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">
              <CheckCircle2 className="h-4 w-4" />
              Payment confirmed
            </div>
            <CardTitle className="text-3xl">Your subscription is active.</CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            {loading && (
              <div className="flex items-center gap-3 text-slate-300">
                <LoadingSpinner size="sm" />
                Verifying your payment and preparing the invoice...
              </div>
            )}

            {error && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-100">{error}</div>
            )}

            {summary && activePlan && (
              <div className="grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 sm:grid-cols-2">
                <div>
                  <div className="text-sm text-slate-400">Plan</div>
                  <div className="text-xl font-semibold">{activePlan.displayName}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-400">Invoice</div>
                  <div className="text-xl font-semibold">{summary.invoiceNumber}</div>
                </div>
                <div className="sm:col-span-2 rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-300">
                  {summary.message}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild className="rounded-full bg-white text-slate-950 hover:bg-cyan-200">
                <Link href="/">
                  <Home className="mr-2 h-4 w-4" />
                  Return home
                </Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full border-white/15 bg-transparent text-white hover:bg-white/10">
                <Link href="/subscription">
                  <FileText className="mr-2 h-4 w-4" />
                  View plans
                </Link>
              </Button>
            </div>

            <p className="text-sm leading-6 text-slate-400">
              If the invoice email does not arrive immediately, refresh this page once. You’ll be redirected home shortly.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
