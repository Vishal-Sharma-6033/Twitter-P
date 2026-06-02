import crypto from "crypto";
import nodemailer from "nodemailer";

export const LANGUAGE_LABELS = {
  en: "English",
  es: "Spanish",
  hi: "Hindi",
  pt: "Portuguese",
  zh: "Chinese",
  fr: "French",
};

export const SUPPORTED_LANGUAGE_CODES = Object.keys(LANGUAGE_LABELS);
export const LANGUAGE_OTP_TTL_MS = 10 * 60 * 1000;

const OTP_SECRET = process.env.LANGUAGE_OTP_SECRET || "twiller-language-otp-secret";
const OTP_STORE = new Map();

export const normalizeLanguageCode = (value = "") => {
  const normalized = String(value).trim().toLowerCase();
  return SUPPORTED_LANGUAGE_CODES.includes(normalized) ? normalized : "en";
};

export const getLanguageDisplayName = (language) =>
  LANGUAGE_LABELS[normalizeLanguageCode(language)] || LANGUAGE_LABELS.en;

export const getLanguageDeliveryChannel = (language) =>
  normalizeLanguageCode(language) === "fr" ? "email" : "mobile";

const createOtpRecordKey = (email, language) => `${email}:${normalizeLanguageCode(language)}`;

export const createLanguageOtp = ({ email, language }) => {
  const normalizedLanguage = normalizeLanguageCode(language);
  const otp = String(crypto.randomInt(100000, 1000000));
  const expiresAt = Date.now() + LANGUAGE_OTP_TTL_MS;
  const key = createOtpRecordKey(email, normalizedLanguage);

  OTP_STORE.set(key, {
    hash: crypto
      .createHmac("sha256", OTP_SECRET)
      .update(`${email}:${normalizedLanguage}:${otp}`)
      .digest("hex"),
    expiresAt,
    attempts: 0,
  });

  return { otp, expiresAt, language: normalizedLanguage };
};

export const verifyLanguageOtp = ({ email, language, otp }) => {
  const normalizedLanguage = normalizeLanguageCode(language);
  const key = createOtpRecordKey(email, normalizedLanguage);
  const record = OTP_STORE.get(key);

  if (!record) {
    return { ok: false, message: "OTP expired. Request a new code." };
  }

  if (Date.now() > record.expiresAt) {
    OTP_STORE.delete(key);
    return { ok: false, message: "OTP expired. Request a new code." };
  }

  const expectedHash = crypto
    .createHmac("sha256", OTP_SECRET)
    .update(`${email}:${normalizedLanguage}:${otp}`)
    .digest("hex");

  if (record.hash !== expectedHash) {
    record.attempts += 1;

    if (record.attempts >= 5) {
      OTP_STORE.delete(key);
      return {
        ok: false,
        message: "Too many invalid attempts. Request a new OTP.",
      };
    }

    OTP_STORE.set(key, record);
    return { ok: false, message: "Invalid OTP. Please try again." };
  }

  OTP_STORE.delete(key);
  return { ok: true, language: normalizedLanguage };
};

export const sendLanguageOtpEmail = async ({ to, language, otp }) => {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || smtpUser || "no-reply@twiller.local";
  const languageName = getLanguageDisplayName(language);

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
      subject: `Your Twiller ${languageName} language OTP`,
      text: `Your OTP for switching Twiller to ${languageName} is ${otp}. It expires in 10 minutes.`,
    });

    return { delivery: "smtp" };
  }

  console.log(`[language-otp][email] ${languageName} OTP for ${to}: ${otp}`);
  return { delivery: "console" };
};

export const sendLanguageOtpSms = async ({ to, language, otp }) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const languageName = getLanguageDisplayName(language);

  if (accountSid && authToken && (fromNumber || messagingServiceSid)) {
    const payload = new URLSearchParams({
      To: to,
      Body: `Your Twiller OTP for ${languageName} is ${otp}. It expires in 10 minutes.`,
    });

    if (messagingServiceSid) {
      payload.set("MessagingServiceSid", messagingServiceSid);
    } else if (fromNumber) {
      payload.set("From", fromNumber);
    }

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: payload,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SMS delivery failed: ${errorText}`);
    }

    return { delivery: "twilio" };
  }

  console.log(`[language-otp][sms] ${languageName} OTP for ${to}: ${otp}`);
  return { delivery: "console" };
};