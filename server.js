const crypto = require("crypto");
const path = require("path");

const express = require("express");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();

const PORT = Number(process.env.PORT || 3000);
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const OTP_SECRET = process.env.OTP_SECRET;
const OTP_EXPIRES_MINUTES = Number(process.env.OTP_EXPIRES_MINUTES || 5);
const OTP_RESEND_COOLDOWN_SECONDS = Number(
  process.env.OTP_RESEND_COOLDOWN_SECONDS || 60
);
const MAX_VERIFY_ATTEMPTS = 5;

if (!OTP_SECRET) {
  throw new Error("OTP_SECRET is required. Set it in .env.");
}

// In-memory store: email -> OTP state
// Production: use Redis/DB.
const otpStore = new Map();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "12mb" }));
app.use(express.static(path.join(__dirname)));
app.use("/exam", express.static(path.join(__dirname, "pages/exam")));

const sendOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // In local development, avoid locking out the login UI while testing.
  max: IS_PRODUCTION ? 10 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many OTP requests. Try again later." }
});

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateOtp() {
  return crypto.randomInt(0, 1000000).toString().padStart(6, "0");
}

function hashOtp(email, otp) {
  return crypto
    .createHash("sha256")
    .update(`${email}:${otp}:${OTP_SECRET}`)
    .digest("hex");
}

function createTransporter() {
  if (process.env.SENDGRID_API_KEY) {
    return nodemailer.createTransport({
      host: "smtp.sendgrid.net",
      port: 587,
      secure: false,
      auth: {
        user: "apikey",
        pass: process.env.SENDGRID_API_KEY
      }
    });
  }

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("SMTP credentials are not configured.");
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

function cleanupExpiredOtps() {
  const now = Date.now();
  for (const [email, record] of otpStore.entries()) {
    if (record.expiresAt <= now) {
      otpStore.delete(email);
    }
  }
}

setInterval(cleanupExpiredOtps, 60 * 1000).unref();

app.post("/send-otp", sendOtpLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }

    const now = Date.now();
    const existing = otpStore.get(email);
    if (existing && now - existing.lastSentAt < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
      return res.status(429).json({
        message: `Please wait ${OTP_RESEND_COOLDOWN_SECONDS} seconds before requesting another OTP.`
      });
    }

    const otp = generateOtp();
    const otpHash = hashOtp(email, otp);
    const expiresAt = now + OTP_EXPIRES_MINUTES * 60 * 1000;

    otpStore.set(email, {
      otpHash,
      expiresAt,
      attempts: 0,
      verified: false,
      lastSentAt: now
    });

    let mailTransporter;
    try {
      mailTransporter = createTransporter();
    } catch (err) {
      if (IS_PRODUCTION) {
        return res.status(500).json({
          message:
            "Email service is not configured. Add SMTP credentials in .env."
        });
      }
      console.warn("send-otp: SMTP is not configured in development mode.");
      console.warn(err?.message || err);
    }

    if (!mailTransporter) {
      console.log(`[DEV OTP] ${email}: ${otp}`);
      return res.json({
        message: "OTP generated in development mode. Check server logs."
      });
    }

    const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
    try {
      await mailTransporter.sendMail({
        from: fromEmail,
        to: email,
        subject: "Your OTP for Login Verification",
        text: `Your OTP is ${otp}. It will expire in ${OTP_EXPIRES_MINUTES} minutes.`,
        html: `<p>Your OTP is <b>${otp}</b>.</p><p>It will expire in ${OTP_EXPIRES_MINUTES} minutes.</p>`
      });
      return res.json({ message: "OTP sent successfully" });
    } catch (err) {
      if (IS_PRODUCTION) {
        throw err;
      }
      console.warn("send-otp: SMTP send failed in development mode.");
      console.warn(err?.message || err);
      console.log(`[DEV OTP] ${email}: ${otp}`);
      return res.json({
        message: "OTP generated in development mode. Check server logs."
      });
    }
  } catch (error) {
    console.error("send-otp error:", error);
    return res.status(500).json({ message: "Failed to send OTP. Try again." });
  }
});

app.post("/verify-otp", (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const otp = String(req.body?.otp || "").trim();

  if (!isValidEmail(email) || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ message: "Invalid OTP" });
  }

  const record = otpStore.get(email);
  if (!record) {
    return res.status(400).json({ message: "Invalid OTP" });
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(email);
    return res.status(400).json({ message: "OTP expired" });
  }

  if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
    otpStore.delete(email);
    return res.status(429).json({ message: "Too many invalid attempts. Request a new OTP." });
  }

  const candidateHash = hashOtp(email, otp);
  const isMatch = crypto.timingSafeEqual(
    Buffer.from(candidateHash, "hex"),
    Buffer.from(record.otpHash, "hex")
  );

  if (!isMatch) {
    record.attempts += 1;
    otpStore.set(email, record);
    return res.status(400).json({ message: "Invalid OTP" });
  }

  record.verified = true;
  record.otpHash = "";
  otpStore.set(email, record);
  return res.json({ message: "OTP verified successfully" });
});

async function transcribeWithWhisper({ audioBase64, mimeType }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const cleanBase64 = String(audioBase64 || "");
  const buffer = Buffer.from(cleanBase64, "base64");
  if (!buffer.length) {
    throw new Error("Audio payload is empty.");
  }

  const form = new FormData();
  const blob = new Blob([buffer], { type: mimeType || "audio/webm" });
  form.append("file", blob, "chunk.webm");
  form.append("model", "whisper-1");
  form.append("language", "en");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`
    },
    body: form
  });

  const rawBody = await response.text();
  let data = {};
  try {
    data = rawBody ? JSON.parse(rawBody) : {};
  } catch (_err) {
    data = {};
  }

  if (!response.ok) {
    const msg = data?.error?.message || `Whisper API HTTP ${response.status}`;
    throw new Error(msg);
  }

  return String(data.text || "").trim();
}

app.post("/api/whisper-transcribe", async (req, res) => {
  try {
    const { audioBase64, mimeType } = req.body || {};
    if (!audioBase64) {
      return res.status(400).json({ message: "audioBase64 is required." });
    }

    const text = await transcribeWithWhisper({ audioBase64, mimeType });
    return res.json({ text });
  } catch (error) {
    const message = error?.message || "Transcription failed.";
    const status = message.includes("OPENAI_API_KEY") ? 500 : 400;
    return res.status(status).json({ message });
  }
});

app.get("/api/whisper-health", (_req, res) => {
  const configured = Boolean(process.env.OPENAI_API_KEY);
  return res.json({
    configured,
    provider: "openai-whisper"
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/login", (_req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
