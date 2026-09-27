const crypto = require("crypto");
const express = require("express");
const db = require("../db");
const { JWT_EXPIRY_DAYS, RESET_TOKEN_HOURS, VERIFY_TOKEN_HOURS } = require("../config");
const { tokenRequired } = require("../middleware/auth");
const { buildAppUrl, sendEmail } = require("../utils/email");
const {
  createAccessToken,
  decodeAccessToken,
  generateToken,
  getBearerToken,
  revokeToken,
  userToDict,
} = require("../utils/jwt");
const { hashPassword, isValidEmail, verifyPassword } = require("../utils/password");

const router = express.Router();

function utcNowIso() {
  return new Date().toISOString();
}

function addHours(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function getUserByEmail(email) {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email);
}

function getUserById(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

router.post("/register", async (req, res) => {
  const data = req.body || {};
  const name = String(data.name || data.fullname || "").trim();
  const email = String(data.email || "").trim().toLowerCase();
  const password = data.password || "";

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required" });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Invalid email address" });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  if (getUserByEmail(email)) {
    return res.status(409).json({ error: "An account with this email already exists" });
  }

  const now = utcNowIso();
  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);

  db.prepare(
    `INSERT INTO users (id, email, password_hash, name, role, email_verified, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'learner', 0, ?, ?)`
  ).run(userId, email, passwordHash, name, now, now);

  const user = getUserById(userId);
  const verificationToken = generateToken();

  db.prepare(
    `INSERT INTO email_verification_tokens (id, user_id, token, expires_at, used, created_at)
     VALUES (?, ?, ?, ?, 0, ?)`
  ).run(crypto.randomUUID(), userId, verificationToken, addHours(VERIFY_TOKEN_HOURS), now);

  const verifyUrl = buildAppUrl(`/log/verify-email.html?token=${verificationToken}`);
  const mail = await sendEmail(
    email,
    "Verify your LearnSphere account",
    `Welcome to LearnSphere!\n\nClick the link below to verify your email:\n${verifyUrl}\n\n` +
      `This link expires in ${VERIFY_TOKEN_HOURS} hours.`
  );

  if (!mail.sent) {
    return res.status(201).json({
      message: "Account created, but the verification email could not be sent.",
      user: userToDict(user),
      email_verification_sent: false,
      error:
        mail.reason === "not_configured"
          ? "Account created, but mail is not configured on the server."
          : "Account created, but the verification email could not be sent.",
    });
  }

  return res.status(201).json({
    message: "Account created. Check your email to verify your account.",
    user: userToDict(user),
    email_verification_sent: true,
  });
});

router.post("/login", async (req, res) => {
  const data = req.body || {};
  const email = String(data.email || "").trim().toLowerCase();
  const password = data.password || "";

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const user = getUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const { token, expiresAt } = createAccessToken(user);

  return res.json({
    token,
    expires_in: JWT_EXPIRY_DAYS * 24 * 60 * 60,
    expires_at: expiresAt.toISOString(),
    user: userToDict(user),
  });
});

router.post("/logout", tokenRequired, (req, res) => {
  const token = getBearerToken(req);
  if (token) {
    const decoded = decodeAccessToken(token);
    if (decoded && decoded.jti) {
      const expiresAt = decoded.exp
        ? new Date(decoded.exp * 1000)
        : new Date(Date.now() + JWT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
      revokeToken(decoded.jti, expiresAt);
    }
  }

  return res.json({ message: "Logged out successfully" });
});

router.get("/me", tokenRequired, (req, res) => {
  const user = getUserById(req.auth.sub);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  return res.json({ user: userToDict(user) });
});

router.post("/forgot-password", async (req, res) => {
  const data = req.body || {};
  const email = String(data.email || "").trim().toLowerCase();

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: "Valid email is required" });
  }

  const user = getUserByEmail(email);
  if (!user) {
    return res.status(404).json({ error: "No account found for that email." });
  }

  const resetToken = generateToken();
  const now = utcNowIso();

  db.prepare(
    `INSERT INTO password_reset_tokens (id, user_id, token, expires_at, used, created_at)
     VALUES (?, ?, ?, ?, 0, ?)`
  ).run(crypto.randomUUID(), user.id, resetToken, addHours(RESET_TOKEN_HOURS), now);

  const resetUrl = buildAppUrl(`/log/reset-password.html?token=${resetToken}`);
  const mail = await sendEmail(
    email,
    "Reset your LearnSphere password",
    `You requested a password reset.\n\nClick the link below to set a new password:\n${resetUrl}\n\n` +
      `This link expires in ${RESET_TOKEN_HOURS} hour(s).\n\n` +
      "If you did not request this, you can ignore this email."
  );

  if (!mail.sent) {
    return res.status(503).json({
      error:
        mail.reason === "not_configured"
          ? "Could not send the reset email. Mail is not configured on the server."
          : "Could not send the reset email. The mail server rejected the login.",
    });
  }

  return res.json({
    message: "A password reset link has been sent to your email.",
  });
});

router.post("/reset-password", async (req, res) => {
  const data = req.body || {};
  const token = String(data.token || "").trim();
  const password = data.password || "";

  if (!token || !password) {
    return res.status(400).json({ error: "Token and new password are required" });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  const resetRecord = db
    .prepare("SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0")
    .get(token);

  if (!resetRecord || resetRecord.expires_at < utcNowIso()) {
    return res.status(400).json({ error: "Invalid or expired reset token" });
  }

  const user = getUserById(resetRecord.user_id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const passwordHash = await hashPassword(password);
  db.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?").run(
    passwordHash,
    utcNowIso(),
    user.id
  );
  db.prepare("UPDATE password_reset_tokens SET used = 1 WHERE id = ?").run(resetRecord.id);

  return res.json({ message: "Password reset successfully. You can now log in." });
});

router.get("/verify-email", (req, res) => {
  const token = String(req.query.token || "").trim();
  return handleVerifyEmail(token, res);
});

router.post("/verify-email", (req, res) => {
  const token = String((req.body || {}).token || "").trim();
  return handleVerifyEmail(token, res);
});

function handleVerifyEmail(token, res) {
  if (!token) {
    return res.status(400).json({ error: "Verification token is required" });
  }

  const record = db
    .prepare("SELECT * FROM email_verification_tokens WHERE token = ? AND used = 0")
    .get(token);

  if (!record || record.expires_at < utcNowIso()) {
    return res.status(400).json({ error: "Invalid or expired verification token" });
  }

  const user = getUserById(record.user_id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  db.prepare("UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ?").run(
    utcNowIso(),
    user.id
  );
  db.prepare("UPDATE email_verification_tokens SET used = 1 WHERE id = ?").run(record.id);

  const updatedUser = getUserById(user.id);
  return res.json({ message: "Email verified successfully", user: userToDict(updatedUser) });
}

module.exports = router;
