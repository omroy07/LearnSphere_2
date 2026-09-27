const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const db = require("../db");
const {
  JWT_SECRET,
  JWT_ALGORITHM,
  JWT_EXPIRY_DAYS,
} = require("../config");

function generateToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function userToDict(user) {
  return {
    id: user.id,
    email: user.email,
    fullname: user.name,
    name: user.name,
    role: user.role,
    email_verified: Boolean(user.email_verified),
  };
}

function createAccessToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = new Date(Date.now() + JWT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    iat: now,
    exp: Math.floor(expiresAt.getTime() / 1000),
    jti: crypto.randomUUID(),
  };

  const token = jwt.sign(payload, JWT_SECRET, { algorithm: JWT_ALGORITHM });
  return { token, expiresAt };
}

function decodeAccessToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
  } catch {
    return null;
  }
}

function isTokenRevoked(jti) {
  if (!jti) return false;
  const row = db.prepare("SELECT id FROM revoked_tokens WHERE jti = ?").get(jti);
  return Boolean(row);
}

function revokeToken(jti, expiresAt) {
  if (!jti || isTokenRevoked(jti)) return;

  db.prepare(
    "INSERT INTO revoked_tokens (id, jti, expires_at, revoked_at) VALUES (?, ?, ?, ?)"
  ).run(crypto.randomUUID(), jti, expiresAt.toISOString(), new Date().toISOString());
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  return null;
}

function getCurrentUserPayload(req) {
  const token = getBearerToken(req);
  if (!token) return null;

  const payload = decodeAccessToken(token);
  if (!payload) return null;
  if (isTokenRevoked(payload.jti)) return null;

  return payload;
}

module.exports = {
  generateToken,
  userToDict,
  createAccessToken,
  decodeAccessToken,
  isTokenRevoked,
  revokeToken,
  getBearerToken,
  getCurrentUserPayload,
};
