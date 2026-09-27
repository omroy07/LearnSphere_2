const { getCurrentUserPayload } = require("../utils/jwt");

function tokenRequired(req, res, next) {
  const payload = getCurrentUserPayload(req);
  if (!payload) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  req.auth = payload;
  next();
}

module.exports = {
  tokenRequired,
};
