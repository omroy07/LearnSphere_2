const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
const JWT_EXPIRY_DAYS = parseInt(process.env.JWT_EXPIRY_DAYS || "7", 10);
const RESET_TOKEN_HOURS = parseInt(process.env.RESET_TOKEN_HOURS || "1", 10);
const VERIFY_TOKEN_HOURS = parseInt(process.env.VERIFY_TOKEN_HOURS || "24", 10);
const AUTH_PORT = parseInt(process.env.AUTH_PORT || "5001", 10);
const APP_BASE_URL = (process.env.APP_BASE_URL || "http://localhost:5173").replace(/\/$/, "");

const defaultDbPath = path.join(__dirname, "..", "instance", "learnsphere.db");
const DATABASE_PATH = process.env.DATABASE_PATH || defaultDbPath;

module.exports = {
  JWT_SECRET,
  JWT_ALGORITHM: "HS256",
  JWT_EXPIRY_DAYS,
  RESET_TOKEN_HOURS,
  VERIFY_TOKEN_HOURS,
  AUTH_PORT,
  APP_BASE_URL,
  DATABASE_PATH,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: parseInt(process.env.SMTP_PORT || "587", 10),
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  SMTP_FROM: process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@learnsphere.local",
};
