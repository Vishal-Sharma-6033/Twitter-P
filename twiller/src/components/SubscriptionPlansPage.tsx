"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Crown, Lock, Sparkles, Timer } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import axiosInstance from "@/lib/axiosInstance";
import {
  formatRupees,
  getPaymentWindowLabel,
  getPlanById,
  isPaymentWindowOpen,
  SUBSCRIPTION_PLANS,
} from "@/lib/subscription";

import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import LoadingSpinner from "./loading-spinner";

interface SubscriptionStatusResponse {
  user: {
    subscriptionPlan?: string;
    subscriptionTweetCount?: number;
    subscriptionTweetLimit?: number;
    subscriptionCycleEndsAt?: string;
  };
}

export default function SubscriptionPlansPage() {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [subscriptionSummary, setSubscriptionSummary] = useState({
    planId: "free",
    tweetCount: 0,
    tweetLimit: 1,
  });

  useEffect(() => {
    const loadStatus = async () => {
      if (!user?.email) {
        return;
      }

      try {
        const response = await axiosInstance.get<SubscriptionStatusResponse>(
          "/subscription/status",
          {
            params: { email: user.email },
          }
        );

        setSubscriptionSummary({
          planId: response.data.user.subscriptionPlan || "free",
          tweetCount: response.data.user.subscriptionTweetCount || 0,
          tweetLimit: response.data.user.subscriptionTweetLimit || 1,
        });
      } catch (fetchError) {
        console.error(fetchError);
      }
    };

    void loadStatus();
  }, [user?.email]);

  const purchasePlan = async (planId: string) => {
    setMessage("");
    setError("");

    if (!user?.email) {
      setError("Please sign in before choosing a plan.");
      return;
    }

    const plan = getPlanById(planId);
    if (!plan.isPaid) {
      setMessage("The free plan is already active. No payment is required.");
      return;
    }

    if (!isPaymentWindowOpen()) {
      setError(`Payments are only allowed between ${getPaymentWindowLabel()}.`);
      return;
    }

    setLoadingPlanId(planId);

    try {
      const response = await axiosInstance.post("/subscription/checkout", {
        email: user.email,
        planId,
      });

      window.location.href = response.data.checkoutUrl;
    } catch (checkoutError) {
      const message =
        checkoutError instanceof Error
          ? checkoutError.message
          : "Failed to start checkout.";
      setError(message);
    } finally {
      setLoadingPlanId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.18),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
            <Timer className="h-4 w-4" />
            Payments open only from 10:00 AM to 11:00 AM IST
          </div>
        </div>

        <div className="max-w-3xl space-y-4">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Choose a plan that matches how you tweet.</h1>
          <p className="text-base leading-7 text-slate-300 sm:text-lg">
            Free users can post one tweet per cycle. Paid plans unlock higher monthly limits, and Gold removes the cap entirely.
          </p>
        </div>

        {(message || error) && (
          <div className="mt-6 max-w-3xl space-y-3">
            {message && <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-100">{message}</div>}
            {error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-100">{error}</div>}
          </div>
        )}

        <div className="mt-8 grid gap-5 lg:grid-cols-4">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isActive = subscriptionSummary.planId === plan.id;
            const tweetLimitLabel = plan.tweetLimit === Number.POSITIVE_INFINITY ? "Unlimited tweets" : `${plan.tweetLimit} tweets per month`;
            const quotaLabel = plan.tweetLimit === Number.POSITIVE_INFINITY ? "Unlimited" : `${subscriptionSummary.tweetCount}/${plan.tweetLimit}`;

            return (
              <Card
                key={plan.id}
                className={`border-white/10 bg-white/5 text-white backdrop-blur ${isActive ? "ring-2 ring-cyan-400/70" : ""}`}
              >
                <CardHeader className="space-y-3 pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-2xl">{plan.displayName}</CardTitle>
                    {plan.id === "gold" ? <Crown className="h-5 w-5 text-amber-300" /> : <Sparkles className="h-5 w-5 text-cyan-300" />}
                  </div>
                  <p className="text-sm text-slate-300">{plan.description}</p>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <div>
                    <div className="text-3xl font-semibold">{formatRupees(plan.amountInRupees)}</div>
                    <div className="mt-1 text-sm text-slate-400">{tweetLimitLabel}</div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300">
                    <div className="flex items-center gap-2 text-white">
                      <Check className="h-4 w-4 text-emerald-300" />
                      Current quota: {quotaLabel}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Lock className="h-4 w-4 text-slate-400" />
                      {isActive ? "This is your active plan." : "Upgrade any time during the payment window."}
                    </div>
                  </div>

                  <Button
                    type="button"
                    className={`w-full rounded-full ${plan.isPaid ? "bg-white text-slate-950 hover:bg-cyan-200" : "bg-emerald-400 text-slate-950 hover:bg-emerald-300"}`}
                    onClick={() => purchasePlan(plan.id)}
                    disabled={loadingPlanId !== null && loadingPlanId !== plan.id}
                  >
                    {loadingPlanId === plan.id ? (
                      <span className="inline-flex items-center gap-2">
                        <LoadingSpinner size="sm" />
                        Preparing checkout...
                      </span>
                    ) : plan.isPaid ? (
                      isActive ? "Current plan" : `Select ${plan.displayName}`
                    ) : (
                      "Free plan"
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-8 max-w-3xl rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
          <div className="font-medium text-white">How billing works</div>
          <ul className="mt-3 space-y-2 leading-6">
            <li>Paid plan checkout is available only between 10:00 AM and 11:00 AM IST.</li>
            <li>The gateway sends you to Stripe Checkout and confirms payment on the success page.</li>
            <li>After confirmation, we email an invoice with plan and billing cycle details.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
