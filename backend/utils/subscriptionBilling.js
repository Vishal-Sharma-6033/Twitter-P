import crypto from "crypto";
import nodemailer from "nodemailer";
import Stripe from "stripe";

const IST_TIME_ZONE = "Asia/Kolkata";
const PAYMENT_WINDOW_START_MINUTES = 10 * 60;
const PAYMENT_WINDOW_END_MINUTES = 11 * 60;
const MONTH_IN_MS = 30 * 24 * 60 * 60 * 1000;

export const SUBSCRIPTION_PLANS = {
  free: {
    id: "free",
    name: "Free Plan",
    displayName: "Free Plan",
    amountInRupees: 0,
    amountInPaise: 0,
    tweetLimit: 1,
    description: "One tweet every 30 days",
    isPaid: false,
  },
  bronze: {
    id: "bronze",
    name: "Bronze Plan",
    displayName: "Bronze Plan",
    amountInRupees: 100,
    amountInPaise: 10000,
    tweetLimit: 3,
    description: "Up to 3 tweets per month",
    isPaid: true,
  },
  silver: {
    id: "silver",
    name: "Silver Plan",
    displayName: "Silver Plan",
    amountInRupees: 300,
    amountInPaise: 30000,
    tweetLimit: 5,
    description: "Up to 5 tweets per month",
    isPaid: true,
  },
  gold: {
    id: "gold",
    name: "Gold Plan",
    displayName: "Gold Plan",
    amountInRupees: 1000,
    amountInPaise: 100000,
    tweetLimit: Infinity,
    description: "Unlimited tweeting per month",
    isPaid: true,
  },
};

const getIstParts = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: IST_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  return parts.reduce((accumulator, part) => {
    if (part.type !== "literal") {
      accumulator[part.type] = Number(part.value);
    }
    return accumulator;
  }, {});
};

export const getPaymentWindowLabel = () => "10:00 AM to 11:00 AM IST";

export const isPaymentWindowOpen = (date = new Date()) => {
  const parts = getIstParts(date);
  const currentMinutes = parts.hour * 60 + parts.minute;
  return (
    currentMinutes >= PAYMENT_WINDOW_START_MINUTES &&
    currentMinutes < PAYMENT_WINDOW_END_MINUTES
  );
};

export const normalizePlanId = (planId = "") => planId.trim().toLowerCase();

export const getPlanConfig = (planId = "free") => {
  const normalizedPlanId = normalizePlanId(planId);
  return SUBSCRIPTION_PLANS[normalizedPlanId] || SUBSCRIPTION_PLANS.free;
};

export const getPlanCycleEndsAt = (startedAt = new Date()) =>
  new Date(startedAt.getTime() + MONTH_IN_MS);

export const createInvoiceNumber = () =>
  `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;

const getStripeClient = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return null;
  }

  return new Stripe(secretKey, {
    apiVersion: "2025-02-24.acacia",
  });
};

export const createSubscriptionCheckoutSession = async ({
  user,
  planId,
  appUrl,
}) => {
  const plan = getPlanConfig(planId);

  if (!plan.isPaid) {
    throw new Error("The free plan does not require payment.");
  }

  const stripe = getStripeClient();
  if (!stripe) {
    throw new Error("Stripe is not configured. Add STRIPE_SECRET_KEY to .env.");
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: user.email,
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "inr",
          product_data: {
            name: plan.displayName,
            description: plan.description,
          },
          unit_amount: plan.amountInPaise,
          recurring: { interval: "month" },
        },
        quantity: 1,
      },
    ],
    success_url: `${appUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/subscription?status=cancelled`,
    metadata: {
      userId: String(user._id),
      email: user.email,
      planId: plan.id,
      planName: plan.displayName,
    },
  });

  return { session, plan };
};

const createTransporter = () => {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpHost || !smtpUser || !smtpPass) {
    return null;
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
};

export const sendSubscriptionInvoiceEmail = async ({
  to,
  plan,
  invoiceNumber,
  transactionId,
  billingCycleStartedAt,
  billingCycleEndsAt,
  paymentGateway = "Stripe",
}) => {
  const transporter = createTransporter();
  const smtpFrom = process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@twiller.local";

  const subject = `Twiller ${plan.displayName} invoice ${invoiceNumber}`;
  const text = [
    `Invoice Number: ${invoiceNumber}`,
    `Plan: ${plan.displayName}`,
    `Amount: ₹${plan.amountInRupees}/month`,
    `Gateway: ${paymentGateway}`,
    `Transaction ID: ${transactionId}`,
    `Billing Cycle: ${billingCycleStartedAt.toDateString()} to ${billingCycleEndsAt.toDateString()}`,
    `Tweet limit: ${plan.tweetLimit === Infinity ? "Unlimited" : plan.tweetLimit}`,
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
      <h2 style="margin-bottom: 0.5rem;">Twiller ${plan.displayName} invoice</h2>
      <p style="margin-top: 0;">Thank you for upgrading your account.</p>
      <table style="border-collapse: collapse; width: 100%; max-width: 640px;">
        <tr><td style="padding: 8px 0; font-weight: 700;">Invoice Number</td><td>${invoiceNumber}</td></tr>
        <tr><td style="padding: 8px 0; font-weight: 700;">Plan</td><td>${plan.displayName}</td></tr>
        <tr><td style="padding: 8px 0; font-weight: 700;">Amount</td><td>₹${plan.amountInRupees} / month</td></tr>
        <tr><td style="padding: 8px 0; font-weight: 700;">Gateway</td><td>${paymentGateway}</td></tr>
        <tr><td style="padding: 8px 0; font-weight: 700;">Transaction ID</td><td>${transactionId}</td></tr>
        <tr><td style="padding: 8px 0; font-weight: 700;">Billing Cycle</td><td>${billingCycleStartedAt.toDateString()} - ${billingCycleEndsAt.toDateString()}</td></tr>
        <tr><td style="padding: 8px 0; font-weight: 700;">Tweet Limit</td><td>${plan.tweetLimit === Infinity ? "Unlimited" : plan.tweetLimit}</td></tr>
      </table>
    </div>
  `;

  if (transporter) {
    await transporter.sendMail({
      from: smtpFrom,
      to,
      subject,
      text,
      html,
    });

    return { delivery: "smtp" };
  }

  console.log(`[subscription-invoice] ${subject}\n${text}`);
  return { delivery: "console" };
};
