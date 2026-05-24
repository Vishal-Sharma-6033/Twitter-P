import crypto from "crypto";
import fs from "fs/promises";
import nodemailer from "nodemailer";
import { parseFile } from "music-metadata";

export const AUDIO_TWEET_MAX_DURATION_SECONDS = 300;
export const AUDIO_TWEET_MAX_SIZE_BYTES = 100 * 1024 * 1024;
export const AUDIO_TWEET_WINDOW_START_MINUTES = 14 * 60;
export const AUDIO_TWEET_WINDOW_END_MINUTES = 19 * 60;
export const AUDIO_OTP_TTL_MS = 10 * 60 * 1000;
export const AUDIO_UPLOAD_TOKEN_TTL_MS = 60 * 60 * 1000;

const OTP_SECRET = process.env.AUDIO_OTP_SECRET || "twiller-audio-otp-secret";
const TOKEN_SECRET =
  process.env.AUDIO_UPLOAD_TOKEN_SECRET || "twiller-audio-upload-secret";

export const audioOtpStore = new Map();

const getTimePartsInTimeZone = (date, timeZone) => {
  const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = dateTimeFormat.formatToParts(date);
  return parts.reduce((accumulator, part) => {
    if (part.type !== "literal") {
      accumulator[part.type] = part.value;
    }
    return accumulator;
  }, {});
};

export const isAudioTweetWindowOpen = (date = new Date()) => {
  const parts = getTimePartsInTimeZone(date, "Asia/Kolkata");
  const currentMinutes = Number(parts.hour) * 60 + Number(parts.minute);
  return (
    currentMinutes >= AUDIO_TWEET_WINDOW_START_MINUTES &&
    currentMinutes <= AUDIO_TWEET_WINDOW_END_MINUTES
  );
};

export const getAudioTweetWindowLabel = () => "2:00 PM and 7:00 PM IST";

export const createAudioOtp = (email) => {
  const otp = String(crypto.randomInt(100000, 1000000));
  const expiresAt = Date.now() + AUDIO_OTP_TTL_MS;

  audioOtpStore.set(email, {
    hash: crypto
      .createHmac("sha256", OTP_SECRET)
      .update(`${email}:${otp}`)
      .digest("hex"),
    expiresAt,
    attempts: 0,
  });

  return { otp, expiresAt };
};

export const verifyAudioOtp = (email, otp) => {
  const record = audioOtpStore.get(email);

  if (!record) {
    return { ok: false, message: "OTP expired. Request a new code." };
  }

  if (Date.now() > record.expiresAt) {
    audioOtpStore.delete(email);
    return { ok: false, message: "OTP expired. Request a new code." };
  }

  const expectedHash = crypto
    .createHmac("sha256", OTP_SECRET)
    .update(`${email}:${otp}`)
    .digest("hex");

  if (record.hash !== expectedHash) {
    record.attempts += 1;

    if (record.attempts >= 5) {
      audioOtpStore.delete(email);
      return {
        ok: false,
        message: "Too many invalid attempts. Request a new OTP.",
      };
    }

    audioOtpStore.set(email, record);
    return { ok: false, message: "Invalid OTP. Please try again." };
  }

  audioOtpStore.delete(email);
  return { ok: true };
};

export const createAudioUploadToken = (email) => {
  const payload = {
    email,
    exp: Date.now() + AUDIO_UPLOAD_TOKEN_TTL_MS,
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", TOKEN_SECRET)
    .update(payloadBase64)
    .digest("base64url");

  return `${payloadBase64}.${signature}`;
};

export const verifyAudioUploadToken = (token) => {
  if (!token || typeof token !== "string") {
    return { ok: false, message: "Missing audio upload token." };
  }

  const [payloadBase64, signature] = token.split(".");
  if (!payloadBase64 || !signature) {
    return { ok: false, message: "Invalid audio upload token." };
  }

  const expectedSignature = crypto
    .createHmac("sha256", TOKEN_SECRET)
    .update(payloadBase64)
    .digest("base64url");

  if (signature !== expectedSignature) {
    return { ok: false, message: "Invalid audio upload token." };
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadBase64, "base64url").toString("utf8"));

    if (!payload?.email || !payload?.exp || Date.now() > payload.exp) {
      return { ok: false, message: "Audio upload token expired." };
    }

    return { ok: true, payload };
  } catch (error) {
    return { ok: false, message: "Invalid audio upload token." };
  }
};

export const sendAudioOtpEmail = async ({ to, otp }) => {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || smtpUser || "no-reply@twiller.local";

  if (smtpHost && smtpUser && smtpPass) {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    await transporter.sendMail({
      from: smtpFrom,
      to,
      subject: "Your Twiller audio tweet OTP",
      text: `Your OTP for audio tweet verification is ${otp}. It expires in 10 minutes.`,
    });

    return { delivery: "smtp" };
  }

  console.log(`[audio-otp] OTP for ${to}: ${otp}`);
  return { delivery: "console" };
};

export const validateAudioFile = async (filePath) => {
  const stats = await fs.stat(filePath);

  if (stats.size > AUDIO_TWEET_MAX_SIZE_BYTES) {
    throw new Error("Audio file exceeds the 100 MB limit.");
  }

  const metadata = await parseFile(filePath);
  const durationSeconds = metadata.format.duration || 0;

  if (durationSeconds > AUDIO_TWEET_MAX_DURATION_SECONDS) {
    throw new Error("Audio file exceeds the 5 minute limit.");
  }

  return {
    sizeBytes: stats.size,
    durationSeconds,
  };
};

export const removeFileIfExists = async (filePath) => {
  try {
    await fs.unlink(filePath);
  } catch {
    // Ignore cleanup errors.
  }
};
