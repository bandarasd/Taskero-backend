require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require("./db");
const userRoutes = require("./routes/userRoutes");
const verificationRoutes = require("./routes/verificationRoutes");
const authRoutes = require("./routes/authRoutes");

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (req, res) => res.json({ status: "User service running" }));

// Auth routes (send-otp, verify-otp, register)
app.use("/auth", authRoutes);

// User routes
app.use("/users", userRoutes);

// Verification routes (can be accessed as /verifications/... or /users/.../verifications/...)
app.use("/verifications", verificationRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("user-service listening on port", PORT));
