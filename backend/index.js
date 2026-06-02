import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import User from "./models/user.js";
import Tweet from "./models/tweet.js";
import PasswordResetRequest from "./models/passwordResetRequest.js";
import SubscriptionPayment from "./models/subscriptionPayment.js";
import {
  AUDIO_TWEET_MAX_SIZE_BYTES,
  AUDIO_TWEET_WINDOW_END_MINUTES,
  AUDIO_TWEET_WINDOW_START_MINUTES,
  audioOtpStore,
  createAudioOtp,
  createAudioUploadToken,
  getAudioTweetWindowLabel,
  isAudioTweetWindowOpen,
  removeFileIfExists,
  sendAudioOtpEmail,
  validateAudioFile,
  verifyAudioOtp,
  verifyAudioUploadToken,
} from "./utils/audioTweet.js";
import {
  createInvoiceNumber,
  createSubscriptionCheckoutSession,
  getPaymentWindowLabel,
  getPlanConfig,
  getPlanCycleEndsAt,
  isPaymentWindowOpen,
  normalizePlanId,
  sendSubscriptionInvoiceEmail,
  SUBSCRIPTION_PLANS,
} from "./utils/subscriptionBilling.js";
import {
  createLanguageOtp,
  getLanguageDeliveryChannel,
  normalizeLanguageCode,
  sendLanguageOtpEmail,
  sendLanguageOtpSms,
  verifyLanguageOtp,
} from "./utils/languageSwitch.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadsRoot = path.join(process.cwd(), "uploads");
const audioUploadsDir = path.join(uploadsRoot, "audio");

await fs.mkdir(audioUploadsDir, { recursive: true });
app.use("/uploads", express.static(uploadsRoot));

app.get("/", (req, res) => {
  res.send("Twiller backend is running successfully");
});

const port = process.env.PORT || 5000;
const url = process.env.MONGODB_URL || process.env.MONOGDB_URL;

const getPublicBaseUrl = (req) => {
  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  return `${protocol}://${req.get("host")}`;
};

const getIstMinutes = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const values = parts.reduce((accumulator, part) => {
    if (part.type !== "literal") {
      accumulator[part.type] = Number(part.value);
    }
    return accumulator;
  }, {});

  return values.hour * 60 + values.minute;
};

const getPlanState = (user) => {
  const now = new Date();
  const currentPlanId = normalizePlanId(user.subscriptionPlan || "free");
  const currentPlan = getPlanConfig(currentPlanId);
  let cycleStartedAt = user.subscriptionCycleStartedAt
    ? new Date(user.subscriptionCycleStartedAt)
    : new Date(user.joinedDate || now);
  let cycleEndsAt = user.subscriptionCycleEndsAt
    ? new Date(user.subscriptionCycleEndsAt)
    : getPlanCycleEndsAt(cycleStartedAt);
  let subscriptionStatus = user.subscriptionStatus || "inactive";
  let subscriptionTweetCount = Number(user.subscriptionTweetCount || 0);
  let subscriptionPlan = currentPlanId;
  let shouldPersist = false;

  if (cycleEndsAt.getTime() <= now.getTime()) {
    subscriptionPlan = "free";
    subscriptionStatus = "inactive";
    subscriptionTweetCount = 0;
    cycleStartedAt = now;
    cycleEndsAt = getPlanCycleEndsAt(now);
    shouldPersist = true;
  }

  if (subscriptionPlan === "free" && cycleEndsAt.getTime() <= now.getTime()) {
    subscriptionTweetCount = 0;
    cycleStartedAt = now;
    cycleEndsAt = getPlanCycleEndsAt(now);
    shouldPersist = true;
  }

  return {
    currentPlan,
    subscriptionPlan,
    subscriptionStatus,
    subscriptionTweetCount,
    cycleStartedAt,
    cycleEndsAt,
    shouldPersist,
  };
};

const normalizeSubscriptionView = (user) => {
  const planState = getPlanState(user);
  const baseUser = typeof user.toObject === "function" ? user.toObject() : { ...user };

  return {
    ...baseUser,
    subscriptionPlan: planState.subscriptionPlan,
    subscriptionStatus: planState.subscriptionStatus,
    subscriptionTweetCount: planState.subscriptionTweetCount,
    subscriptionCycleStartedAt: planState.cycleStartedAt,
    subscriptionCycleEndsAt: planState.cycleEndsAt,
    subscriptionTweetLimit: planState.currentPlan.tweetLimit,
  };
};

const ensureSubscriptionState = async (user) => {
  const planState = getPlanState(user);

  if (!planState.shouldPersist) {
    return normalizeSubscriptionView(user);
  }

  user.subscriptionPlan = planState.subscriptionPlan;
  user.subscriptionStatus = planState.subscriptionStatus;
  user.subscriptionTweetCount = planState.subscriptionTweetCount;
  user.subscriptionCycleStartedAt = planState.cycleStartedAt;
  user.subscriptionCycleEndsAt = planState.cycleEndsAt;
  await user.save();

  return normalizeSubscriptionView(user);
};

const canUserPostTweet = (user) => {
  const planState = getPlanState(user);
  const tweetLimit = planState.currentPlan.tweetLimit;

  if (tweetLimit === Infinity) {
    return { ok: true, limit: tweetLimit, currentPlan: planState.currentPlan };
  }

  if (planState.subscriptionTweetCount >= tweetLimit) {
    return {
      ok: false,
      limit: tweetLimit,
      currentPlan: planState.currentPlan,
      error: `Your ${planState.currentPlan.displayName} allows only ${tweetLimit} tweet${tweetLimit === 1 ? "" : "s"} per month. Upgrade your plan to post more.`,
    };
  }

  return { ok: true, limit: tweetLimit, currentPlan: planState.currentPlan };
};

const buildBillingPeriod = (user) => {
  const startedAt = user.subscriptionCycleStartedAt
    ? new Date(user.subscriptionCycleStartedAt)
    : new Date();
  const endsAt = user.subscriptionCycleEndsAt
    ? new Date(user.subscriptionCycleEndsAt)
    : getPlanCycleEndsAt(startedAt);

  return { startedAt, endsAt };
};

const normalizeEmail = (value = "") => value.trim().toLowerCase();

const normalizePhone = (value = "") => value.replace(/\D/g, "");
const normalizeLanguage = (value = "") => normalizeLanguageCode(value);

const getDayKey = (date = new Date()) => date.toISOString().slice(0, 10);

const resolvePasswordResetIdentity = (identifier, identifierType) => {
  const resolvedType =
    identifierType === "phone" || identifierType === "email"
      ? identifierType
      : identifier.includes("@")
        ? "email"
        : "phone";

  return {
    identifierType: resolvedType,
    identifier:
      resolvedType === "email" ? normalizeEmail(identifier) : normalizePhone(identifier),
  };
};

const audioStorage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, audioUploadsDir);
  },
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname) || ".webm";
    callback(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
  },
});

const audioUpload = multer({
  storage: audioStorage,
  limits: { fileSize: AUDIO_TWEET_MAX_SIZE_BYTES },
  fileFilter: (req, file, callback) => {
    if (!file.mimetype.startsWith("audio/")) {
      return callback(new Error("Only audio files are allowed."));
    }

    callback(null, true);
  },
});

mongoose
  .connect(url)
  .then(() => {
    console.log("✅ Connected to MongoDB");
    app.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
  });

const runAudioUpload = (req, res, callback) => {
  audioUpload.single("audio")(req, res, callback);
};

const ensureAudioUploadAllowed = (req, res) => {
  if (!isAudioTweetWindowOpen()) {
    res.status(403).send({
      error: `Audio tweets are only allowed between ${getAudioTweetWindowLabel()}.`,
    });
    return false;
  }

  return true;
};

app.post("/audio-otp/request", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).send({ error: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).send({ error: "No registered user found for this email." });
    }

    const { otp, expiresAt } = createAudioOtp(email);
    const delivery = await sendAudioOtpEmail({ to: email, otp });

    return res.status(200).send({
      message: "OTP sent to the registered email address.",
      expiresAt,
      delivery: delivery.delivery,
      devOtp: process.env.NODE_ENV === "production" ? undefined : otp,
    });
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

app.post("/audio-otp/verify", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).send({ error: "Email and OTP are required" });
    }

    const result = verifyAudioOtp(email, otp);
    if (!result.ok) {
      return res.status(400).send({ error: result.message });
    }

    return res.status(200).send({
      message: "OTP verified successfully.",
      uploadToken: createAudioUploadToken(email),
      expiresAt: Date.now() + 60 * 60 * 1000,
    });
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

app.post("/language-otp/request", async (req, res) => {
  try {
    const { email, language } = req.body;

    if (!email || !language) {
      return res.status(400).send({ error: "Email and language are required." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).send({ error: "No registered user found for this email." });
    }

    const normalizedLanguage = normalizeLanguage(language);
    const deliveryChannel = getLanguageDeliveryChannel(normalizedLanguage);
    const { otp, expiresAt } = createLanguageOtp({ email, language: normalizedLanguage });

    if (deliveryChannel === "email") {
      await sendLanguageOtpEmail({ to: user.email, language: normalizedLanguage, otp });
    } else {
      if (!user.phone) {
        return res.status(400).send({
          error: "A registered mobile number is required to switch to this language.",
        });
      }

      await sendLanguageOtpSms({ to: user.phone, language: normalizedLanguage, otp });
    }

    return res.status(200).send({
      message: `OTP sent to the registered ${deliveryChannel === "email" ? "email address" : "mobile number"}.`,
      expiresAt,
      delivery: deliveryChannel,
      devOtp: process.env.NODE_ENV === "production" ? undefined : otp,
      language: normalizedLanguage,
    });
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

app.post("/language-otp/verify", async (req, res) => {
  try {
    const { email, language, otp } = req.body;

    if (!email || !language || !otp) {
      return res.status(400).send({ error: "Email, language, and OTP are required." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).send({ error: "No registered user found for this email." });
    }

    const verification = verifyLanguageOtp({ email, language, otp });
    if (!verification.ok) {
      return res.status(400).send({ error: verification.message });
    }

    user.preferredLanguage = verification.language;
    await user.save();

    const updatedUser = await User.findOne({ email });
    return res.status(200).send({
      message: "Language updated successfully.",
      user: updatedUser,
    });
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

//Register
app.post("/register", async (req, res) => {
  try {
    const existinguser = await User.findOne({ email: req.body.email });
    if (existinguser) {
      return res.status(200).send(existinguser);
    }
    const newUser = new User(req.body);
    await newUser.save();
    return res.status(201).send(newUser);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});
// loggedinuser
app.get("/loggedinuser", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).send({ error: "Email required" });
    }
    const user = await User.findOne({ email: email });
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }

    const normalizedUser = await ensureSubscriptionState(user);
    return res.status(200).send(normalizedUser);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

app.get("/subscription/plans", async (req, res) => {
  try {
    return res.status(200).send({
      plans: Object.values(SUBSCRIPTION_PLANS),
      paymentWindow: getPaymentWindowLabel(),
    });
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

app.get("/subscription/status", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).send({ error: "Email required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }

    const normalizedUser = await ensureSubscriptionState(user);
    return res.status(200).send({ user: normalizedUser, plans: Object.values(SUBSCRIPTION_PLANS) });
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

app.post("/subscription/checkout", async (req, res) => {
  try {
    const { email, planId } = req.body;

    if (!email || !planId) {
      return res.status(400).send({ error: "Email and plan are required." });
    }

    if (!isPaymentWindowOpen()) {
      return res.status(403).send({
        error: `Payments are only allowed between ${getPaymentWindowLabel()}.`,
      });
    }

    const plan = getPlanConfig(planId);
    if (!plan.isPaid) {
      return res.status(400).send({ error: "The free plan does not require payment." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }

    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const { session } = await createSubscriptionCheckoutSession({
      user,
      planId: plan.id,
      appUrl,
    });

    const invoiceNumber = createInvoiceNumber();
    await SubscriptionPayment.findOneAndUpdate(
      { checkoutSessionId: session.id },
      {
        user: user._id,
        email: user.email,
        planId: plan.id,
        planName: plan.displayName,
        amountInPaise: plan.amountInPaise,
        currency: "INR",
        gateway: "stripe",
        checkoutSessionId: session.id,
        invoiceNumber,
        status: "pending",
      },
      { upsert: true, new: true }
    );

    return res.status(200).send({
      checkoutUrl: session.url,
      sessionId: session.id,
      plan,
    });
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

app.post("/subscription/confirm", async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).send({ error: "Session ID is required." });
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return res.status(400).send({ error: "Stripe is not configured." });
    }

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    if (session.payment_status !== "paid") {
      return res.status(400).send({ error: "Payment has not been completed yet." });
    }

    const plan = getPlanConfig(session.metadata?.planId || "free");
    if (!plan.isPaid) {
      return res.status(400).send({ error: "Invalid subscription plan." });
    }

    const user = await User.findOne({ email: session.metadata?.email || session.customer_email });
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }

    const billingCycleStartedAt = new Date();
    const billingCycleEndsAt = getPlanCycleEndsAt(billingCycleStartedAt);
    const transactionId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id || session.id;
    const invoiceNumber =
      (await SubscriptionPayment.findOne({ checkoutSessionId: sessionId }))?.invoiceNumber ||
      createInvoiceNumber();

    const paymentRecord = await SubscriptionPayment.findOneAndUpdate(
      { checkoutSessionId: sessionId },
      {
        user: user._id,
        email: user.email,
        planId: plan.id,
        planName: plan.displayName,
        amountInPaise: plan.amountInPaise,
        currency: "INR",
        gateway: "stripe",
        checkoutSessionId: sessionId,
        invoiceNumber,
        status: "paid",
        billingCycleStartedAt,
        billingCycleEndsAt,
        paymentCompletedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    user.subscriptionPlan = plan.id;
    user.subscriptionStatus = "active";
    user.subscriptionCycleStartedAt = billingCycleStartedAt;
    user.subscriptionCycleEndsAt = billingCycleEndsAt;
    user.subscriptionTweetCount = 0;
    user.stripeCustomerId =
      typeof session.customer === "string"
        ? session.customer
        : session.customer?.id || user.stripeCustomerId;
    await user.save();

    if (!paymentRecord.invoiceEmailSentAt) {
      await sendSubscriptionInvoiceEmail({
        to: user.email,
        plan,
        invoiceNumber,
        transactionId,
        billingCycleStartedAt,
        billingCycleEndsAt,
        paymentGateway: "Stripe",
      });

      paymentRecord.invoiceEmailSentAt = new Date();
      await paymentRecord.save();
    }

    return res.status(200).send({
      message: "Subscription activated successfully.",
      user: normalizeSubscriptionView(user),
      payment: paymentRecord,
    });
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});
// update Profile
app.patch("/userupdate/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const updated = await User.findOneAndUpdate(
      { email },
      { $set: req.body },
      { new: true, upsert: false }
    );
    return res.status(200).send(updated);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

app.post("/forgot-password/request", async (req, res) => {
  try {
    const { identifier, identifierType } = req.body;

    if (!identifier || typeof identifier !== "string") {
      return res.status(400).send({ error: "Email or phone number is required." });
    }

    const resolvedIdentity = resolvePasswordResetIdentity(identifier, identifierType);
    const requestedDay = getDayKey();

    const userQuery =
      resolvedIdentity.identifierType === "email"
        ? { email: resolvedIdentity.identifier }
        : { phone: resolvedIdentity.identifier };

    const user = await User.findOne(userQuery);
    if (!user) {
      return res.status(404).send({ error: "No account was found for the provided email or phone number." });
    }

    const existingRequest = await PasswordResetRequest.findOne({
      identifier: resolvedIdentity.identifier,
      requestedDay,
    });

    if (existingRequest) {
      return res.status(429).send({
        error: "You can use this option only one time per day.",
      });
    }

    await PasswordResetRequest.create({
      identifier: resolvedIdentity.identifier,
      identifierType: resolvedIdentity.identifierType,
      email: user.email,
      requestedDay,
    });

    return res.status(200).send({
      message: "Password reset request approved.",
      email: user.email,
      identifierType: resolvedIdentity.identifierType,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(429).send({
        error: "You can use this option only one time per day.",
      });
    }

    return res.status(400).send({ error: error.message });
  }
});
// Tweet API

// POST
app.post("/post", async (req, res) => {
  try {
    const hasTextContent = typeof req.body.content === "string" && req.body.content.trim();
    const hasImage = Boolean(req.body.image);
    const hasAudio = Boolean(req.body.audioUrl);
    const authorUser = await User.findById(req.body.author);

    if (!hasTextContent && !hasImage && !hasAudio) {
      return res.status(400).send({
        error: "Tweet content, image, or audio is required.",
      });
    }

    if (!authorUser) {
      return res.status(404).send({ error: "User not found" });
    }

    await ensureSubscriptionState(authorUser);
    const tweetGate = canUserPostTweet(authorUser);
    if (!tweetGate.ok) {
      return res.status(403).send({ error: tweetGate.error });
    }

    const tweet = new Tweet({
      ...req.body,
      content: req.body.content || "",
      postType: req.body.postType || "text",
    });
    await tweet.save();
    authorUser.subscriptionTweetCount = Number(authorUser.subscriptionTweetCount || 0) + 1;
    await authorUser.save();
    return res.status(201).send(tweet);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

app.post("/audio/post", async (req, res) => {
  runAudioUpload(req, res, async (uploadError) => {
    try {
      if (uploadError) {
        return res.status(400).send({ error: uploadError.message });
      }

      const { author, email, uploadToken, content = "" } = req.body;

      if (!author || !email || !uploadToken) {
        await removeFileIfExists(req.file?.path);
        return res.status(400).send({
          error: "Author, email, and audio upload token are required.",
        });
      }

      if (!ensureAudioUploadAllowed(req, res)) {
        await removeFileIfExists(req.file?.path);
        return;
      }

      const verifiedToken = verifyAudioUploadToken(uploadToken);
      if (!verifiedToken.ok) {
        await removeFileIfExists(req.file?.path);
        return res.status(401).send({ error: verifiedToken.message });
      }

      if (verifiedToken.payload.email !== email) {
        await removeFileIfExists(req.file?.path);
        return res.status(401).send({
          error: "Audio upload token does not match the authenticated email.",
        });
      }

      const user = await User.findOne({ email });
      if (!user || user._id.toString() !== author) {
        await removeFileIfExists(req.file?.path);
        return res.status(403).send({ error: "Audio upload is only allowed for the signed-in user." });
      }

      await ensureSubscriptionState(user);
      const tweetGate = canUserPostTweet(user);
      if (!tweetGate.ok) {
        await removeFileIfExists(req.file?.path);
        return res.status(403).send({ error: tweetGate.error });
      }

      if (!req.file) {
        return res.status(400).send({ error: "An audio file is required." });
      }

      const audioStats = await validateAudioFile(req.file.path);
      const audioUrl = `${getPublicBaseUrl(req)}/uploads/audio/${req.file.filename}`;

      const tweet = new Tweet({
        author: user._id,
        content: typeof content === "string" ? content : "",
        postType: "audio",
        audioUrl,
        audioDurationSeconds: audioStats.durationSeconds,
        audioSizeBytes: audioStats.sizeBytes,
      });

      await tweet.save();
      user.subscriptionTweetCount = Number(user.subscriptionTweetCount || 0) + 1;
      await user.save();
      return res.status(201).send(tweet);
    } catch (error) {
      await removeFileIfExists(req.file?.path);
      return res.status(400).send({ error: error.message });
    }
  });
});
// get all tweet
app.get("/post", async (req, res) => {
  try {
    const tweet = await Tweet.find().sort({ timestamp: -1 }).populate("author");
    return res.status(200).send(tweet);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});
//  LIKE TWEET
app.post("/like/:tweetid", async (req, res) => {
  try {
    const { userId } = req.body;
    const tweet = await Tweet.findById(req.params.tweetid);
    if (!tweet.likedBy.includes(userId)) {
      tweet.likes += 1;
      tweet.likedBy.push(userId);
      await tweet.save();
    }
    res.send(tweet);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});
// retweet 
app.post("/retweet/:tweetid", async (req, res) => {
  try {
    const { userId } = req.body;
    const tweet = await Tweet.findById(req.params.tweetid);
    if (!tweet.retweetedBy.includes(userId)) {
      tweet.retweets += 1;
      tweet.retweetedBy.push(userId);
      await tweet.save();
    }
    res.send(tweet);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

// delete tweet
app.delete("/post/:tweetid", async (req, res) => {
  try {
    const { userId } = req.body;
    const tweet = await Tweet.findById(req.params.tweetid);

    if (!tweet) {
      return res.status(404).send({ error: "Tweet not found" });
    }

    if (!userId || tweet.author.toString() !== userId) {
      return res.status(403).send({ error: "You can only delete your own tweet" });
    }

    await Tweet.findByIdAndDelete(req.params.tweetid);
    return res.status(200).send({ message: "Tweet deleted successfully" });
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});