import mongoose from "mongoose";

const SubscriptionPaymentSchema = mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    email: { type: String, required: true, index: true },
    planId: { type: String, required: true, index: true },
    planName: { type: String, required: true },
    amountInPaise: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    gateway: { type: String, default: "stripe" },
    checkoutSessionId: { type: String, required: true, unique: true, index: true },
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    status: { type: String, default: "pending", index: true },
    billingCycleStartedAt: { type: Date },
    billingCycleEndsAt: { type: Date },
    paymentCompletedAt: { type: Date },
    invoiceEmailSentAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("SubscriptionPayment", SubscriptionPaymentSchema);