const express = require("express");
const cors = require("cors");
const { AUTH_PORT } = require("./config");
const authRoutes = require("./routes/auth");
const apiRoutes = require("./routes/api");

require("./db");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "learnsphere-auth" });
});

app.use("/api/auth", authRoutes);
app.use("/api", apiRoutes);

app.listen(AUTH_PORT, "0.0.0.0", () => {
  console.log(`LearnSphere auth server running on http://127.0.0.1:${AUTH_PORT}`);
});
