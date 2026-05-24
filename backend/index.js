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
    return res.status(200).send(user);
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
// Tweet API

// POST
app.post("/post", async (req, res) => {
  try {
    const hasTextContent = typeof req.body.content === "string" && req.body.content.trim();
    const hasImage = Boolean(req.body.image);
    const hasAudio = Boolean(req.body.audioUrl);

    if (!hasTextContent && !hasImage && !hasAudio) {
      return res.status(400).send({
        error: "Tweet content, image, or audio is required.",
      });
    }

    const tweet = new Tweet({
      ...req.body,
      content: req.body.content || "",
      postType: req.body.postType || "text",
    });
    await tweet.save();
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