const bcrypt = require("bcryptjs");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
  return Boolean(email && EMAIL_REGEX.test(String(email).trim()));
}

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function verifyPassword(password, passwordHash) {
  try {
    return bcrypt.compare(password, passwordHash);
  } catch {
    return false;
  }
}

module.exports = {
  isValidEmail,
  hashPassword,
  verifyPassword,
};
