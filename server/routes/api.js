const express = require("express");
const { getCurrentUserPayload } = require("../utils/jwt");

const router = express.Router();

const ACTION_RULES = {
  create_class: ["teacher"],
  build_assignment: ["teacher"],
  export_progress: ["learner", "parent", "teacher"],
  submit_quiz: ["learner"],
  clear_progress: ["learner"],
  manage_sync: ["learner"],
};

router.post("/verify-permission", (req, res) => {
  const action = (req.body || {}).action;
  const payload = getCurrentUserPayload(req);

  if (!payload) {
    return res.status(401).json({ success: false, error: "Invalid or expired token" });
  }

  const role = payload.role || "learner";
  const allowedRoles = ACTION_RULES[action];

  if (allowedRoles === undefined) {
    return res.json({ success: true, role, action });
  }

  if (!allowedRoles.includes(role)) {
    return res.status(403).json({ success: false, error: "Unauthorized", role });
  }

  return res.json({ success: true, role, action });
});

module.exports = router;
