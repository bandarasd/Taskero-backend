require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require("./db");
const userRoutes = require("./routes/userRoutes");
const verificationRoutes = require("./routes/verificationRoutes");
const authRoutes = require("./routes/authRoutes");
const attachUser = require("../shared/middleware/attachUser");

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json());
app.use(attachUser(pool));
app.use((req, _res, next) => {
  console.log(`[user-service] ${req.method} ${req.url}`);
  next();
});

// Health check
app.get("/health", (req, res) => res.json({ status: "User service running" }));

// Auth routes (send-otp, verify-otp, register)
app.use("/auth", authRoutes);

// User routes
app.use("/users", userRoutes);

// Verification routes (can be accessed as /verifications/... or /users/.../verifications/...)
app.use("/verifications", verificationRoutes);

const admin = require('../shared/firebaseAdmin');

const errorHandler = require('../shared/middleware/errorHandler');
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("user-service listening on port", PORT);
  // Pre-fetch Firebase public keys so the first real verifyIdToken call is fast
  admin.auth().getUser('warmup-probe').catch(() => {});
});
