import mongoose from "mongoose";
const UserSchema = mongoose.Schema({
  username: { type: String, required: true },
  displayName: { type: String, required: true },
  avatar: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, default: "", index: true },
  subscriptionPlan: { type: String, default: "free", index: true },
  subscriptionStatus: { type: String, default: "inactive", index: true },
  subscriptionCycleStartedAt: { type: Date, default: Date.now },
  subscriptionCycleEndsAt: { type: Date, default: Date.now },
  subscriptionTweetCount: { type: Number, default: 0 },
  stripeCustomerId: { type: String, default: "" },
  bio: { type: String, default: "" },
  location: { type: String, default: "" },
  website: { type: String, default: "" },
  joinedDate: { type: Date, default: Date.now() },
});

export default mongoose.model("User", UserSchema);
