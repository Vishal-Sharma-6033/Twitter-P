export type SubscriptionPlanId = "free" | "bronze" | "silver" | "gold";

export interface SubscriptionPlanConfig {
  id: SubscriptionPlanId;
  displayName: string;
  amountInRupees: number;
  tweetLimit: number;
  description: string;
  isPaid: boolean;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlanConfig[] = [
  {
    id: "free",
    displayName: "Free Plan",
    amountInRupees: 0,
    tweetLimit: 1,
    description: "One tweet every 30 days",
    isPaid: false,
  },
  {
    id: "bronze",
    displayName: "Bronze Plan",
    amountInRupees: 100,
    tweetLimit: 3,
    description: "Up to 3 tweets per month",
    isPaid: true,
  },
  {
    id: "silver",
    displayName: "Silver Plan",
    amountInRupees: 300,
    tweetLimit: 5,
    description: "Up to 5 tweets per month",
    isPaid: true,
  },
  {
    id: "gold",
    displayName: "Gold Plan",
    amountInRupees: 1000,
    tweetLimit: Number.POSITIVE_INFINITY,
    description: "Unlimited tweeting per month",
    isPaid: true,
  },
];

const PAYMENT_WINDOW_START_MINUTES = 10 * 60;
const PAYMENT_WINDOW_END_MINUTES = 11 * 60;

const getIstMinutes = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  return parts.reduce((accumulator, part) => {
    if (part.type !== "literal") {
      accumulator[part.type] = Number(part.value);
    }
    return accumulator;
  }, {} as Record<string, number>);
};

export const isPaymentWindowOpen = (date = new Date()) => {
  const parts = getIstMinutes(date);
  const currentMinutes = parts.hour * 60 + parts.minute;
  return currentMinutes >= PAYMENT_WINDOW_START_MINUTES && currentMinutes < PAYMENT_WINDOW_END_MINUTES;
};

export const getPaymentWindowLabel = () => "10:00 AM to 11:00 AM IST";

export const getPlanById = (planId: string) =>
  SUBSCRIPTION_PLANS.find((plan) => plan.id === planId) || SUBSCRIPTION_PLANS[0];

export const formatRupees = (amountInRupees: number) =>
  amountInRupees === 0 ? "Free" : `₹${amountInRupees}/month`;
